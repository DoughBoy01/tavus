import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Subscription tiers with prices
const SUBSCRIPTION_TIERS = {
  basic: {
    name: 'Basic Plan',
    price: 9900, // $99.00 in cents
    leads: 10,
    features: [
      '10 leads per month',
      '1 practice area',
      'Email support',
      'Basic analytics',
    ],
  },
  pro: {
    name: 'Pro Plan',
    price: 29900, // $299.00 in cents
    leads: 50,
    features: [
      '50 leads per month',
      '3 practice areas',
      'Priority support',
      'Advanced analytics',
      'Lead quality scoring',
    ],
  },
  enterprise: {
    name: 'Enterprise Plan',
    price: 99900, // $999.00 in cents
    leads: 999,
    features: [
      'Unlimited leads',
      'All practice areas',
      '24/7 dedicated support',
      'Custom analytics',
      'API access',
      'White-label options',
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tier, lawFirmId } = await req.json();

    if (!tier || !SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS]) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!lawFirmId) {
      return new Response(
        JSON.stringify({ error: 'Law firm ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get law firm details
    const { data: lawFirm, error: firmError } = await supabase
      .from('law_firms')
      .select('id, name, billing_email, contact_email, stripe_customer_id')
      .eq('id', lawFirmId)
      .single();

    if (firmError || !lawFirm) {
      return new Response(
        JSON.stringify({ error: 'Law firm not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    const email = lawFirm.billing_email || lawFirm.contact_email;

    // Create or retrieve Stripe customer
    let customerId = lawFirm.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: lawFirm.name,
        metadata: {
          law_firm_id: lawFirm.id,
        },
      });

      customerId = customer.id;

      // Update law firm with customer ID
      await supabase
        .from('law_firms')
        .update({ stripe_customer_id: customerId })
        .eq('id', lawFirm.id);
    }

    // Create Stripe Price (in real production, create these via Stripe Dashboard)
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: tierConfig.price,
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: tierConfig.name,
        description: `${tierConfig.leads} leads per month`,
        metadata: {
          tier,
          max_leads: tierConfig.leads.toString(),
        },
      },
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      success_url: `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/admin/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/admin/billing?cancelled=true`,
      metadata: {
        law_firm_id: lawFirm.id,
        tier,
      },
      subscription_data: {
        metadata: {
          law_firm_id: lawFirm.id,
          tier,
        },
        trial_period_days: 14, // 14-day free trial
      },
      allow_promotion_codes: true,
    });

    console.log('✅ Checkout session created:', session.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
