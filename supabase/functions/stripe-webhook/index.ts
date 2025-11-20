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

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
};

// Subscription tier mapping
const TIER_CONFIG = {
  basic: { limit: 10, price: 99 },
  pro: { limit: 50, price: 299 },
  enterprise: { limit: 999, price: 999 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret');
      return new Response('Webhook signature missing', { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    console.log('📨 Received Stripe webhook:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log('🔄 Updating subscription:', subscription.id);

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  // Get law firm by stripe customer ID
  const { data: firm, error: firmError } = await supabase
    .from('law_firms')
    .select('id, name')
    .eq('stripe_customer_id', customerId)
    .single();

  if (firmError || !firm) {
    console.error('Law firm not found for customer:', customerId);
    return;
  }

  // Determine tier from subscription metadata or product
  const tier = subscription.metadata.tier || 'basic';
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.basic;

  // Update subscription in database
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      law_firm_id: firm.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      plan_name: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`,
      plan_tier: tier,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      amount: tierConfig.price,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id'
    });

  if (subError) {
    console.error('Error upserting subscription:', subError);
    return;
  }

  // Update law firm record
  await supabase
    .from('law_firms')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      monthly_lead_limit: tierConfig.limit,
      subscription_started_at: new Date(subscription.created * 1000).toISOString(),
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    })
    .eq('id', firm.id);

  console.log(`✅ Updated subscription for ${firm.name} to ${tier} tier`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Subscription deleted:', subscription.id);

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Update law firm to free tier
  await supabase
    .from('law_firms')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      monthly_lead_limit: 3,
    })
    .eq('stripe_customer_id', customerId);

  console.log('✅ Subscription cancelled and firm moved to free tier');
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Payment succeeded for invoice:', invoice.id);

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  // Get law firm
  const { data: firm } = await supabase
    .from('law_firms')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!firm) return;

  // Create notification for firm admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('law_firm_id', firm.id)
    .eq('role', 'legal_admin');

  if (admins) {
    for (const admin of admins) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        law_firm_id: firm.id,
        type: 'payment_due',
        title: 'Payment Successful',
        message: `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed successfully.`,
        link: '/admin/billing',
      });
    }
  }

  console.log('✅ Payment notification sent');
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('❌ Payment failed for invoice:', invoice.id);

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  // Get law firm
  const { data: firm } = await supabase
    .from('law_firms')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!firm) return;

  // Update subscription status to past_due
  await supabase
    .from('law_firms')
    .update({ subscription_status: 'past_due' })
    .eq('id', firm.id);

  // Create notification for firm admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('law_firm_id', firm.id)
    .eq('role', 'legal_admin');

  if (admins) {
    for (const admin of admins) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        law_firm_id: firm.id,
        type: 'payment_due',
        title: '⚠️ Payment Failed',
        message: 'Your recent payment failed. Please update your payment method to continue your subscription.',
        link: '/admin/billing',
      });
    }
  }

  console.log('✅ Payment failure notification sent');
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout completed:', session.id);

  // The subscription will be handled by subscription.created webhook
  // This is just for logging and additional tracking
  const firmId = session.metadata?.law_firm_id;

  if (firmId) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('law_firm_id', firmId)
      .eq('role', 'legal_admin');

    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          law_firm_id: firmId,
          type: 'subscription_expiring',
          title: '🎉 Welcome to Premium!',
          message: 'Your subscription has been activated. You now have access to premium features!',
          link: '/admin/firm-dashboard',
        });
      }
    }
  }
}
