import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Check,
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
  Crown,
  Zap,
  Sparkles
} from 'lucide-react';

interface SubscriptionPlan {
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  name: string;
  price: number;
  leads: number;
  features: string[];
}

const PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    name: 'Free Tier',
    price: 0,
    leads: 3,
    features: [
      '3 leads per month',
      '1 practice area',
      'Email support',
      'Basic dashboard',
    ],
  },
  {
    tier: 'basic',
    name: 'Basic Plan',
    price: 99,
    leads: 10,
    features: [
      '10 leads per month',
      '1 practice area',
      'Email support',
      'Basic analytics',
      'Lead notifications',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro Plan',
    price: 299,
    leads: 50,
    features: [
      '50 leads per month',
      '3 practice areas',
      'Priority support',
      'Advanced analytics',
      'Lead quality scoring',
      'Custom matching preferences',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise Plan',
    price: 999,
    leads: 999,
    features: [
      'Unlimited leads',
      'All practice areas',
      '24/7 dedicated support',
      'Custom analytics & reporting',
      'API access',
      'White-label options',
      'Dedicated account manager',
    ],
  },
];

export const BillingDashboard = () => {
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>(PLANS[0]);
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState({ used: 0, limit: 3 });
  const [isLoading, setIsLoading] = useState(true);
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const [firmId, setFirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionData();
  }, [user]);

  const fetchSubscriptionData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Get user's law firm
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', user.id)
        .single();

      if (!profile?.law_firm_id) {
        console.error('User not associated with a law firm');
        return;
      }

      setFirmId(profile.law_firm_id);

      // Get law firm with subscription details
      const { data: firm, error: firmError } = await supabase
        .from('law_firms')
        .select('subscription_tier, subscription_status, monthly_lead_limit, leads_used_this_month')
        .eq('id', profile.law_firm_id)
        .single();

      if (firmError) throw firmError;

      // Get subscription details
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('law_firm_id', profile.law_firm_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sub) {
        setSubscription(sub);
      }

      // Set current plan
      const plan = PLANS.find(p => p.tier === firm?.subscription_tier) || PLANS[0];
      setCurrentPlan(plan);

      // Set usage
      setUsage({
        used: firm?.leads_used_this_month || 0,
        limit: firm?.monthly_lead_limit || 3,
      });

    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (tier: string) => {
    if (!firmId) return;

    try {
      setProcessingTier(tier);

      // Call edge function to create checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { tier, lawFirmId: firmId },
      });

      if (error) throw error;

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }

    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setProcessingTier(null);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic':
        return <Zap className="h-5 w-5" />;
      case 'pro':
        return <Crown className="h-5 w-5" />;
      case 'enterprise':
        return <Sparkles className="h-5 w-5" />;
      default:
        return <Users className="h-5 w-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'border-blue-500 bg-blue-950/20';
      case 'pro':
        return 'border-purple-500 bg-purple-950/20';
      case 'enterprise':
        return 'border-amber-500 bg-amber-950/20';
      default:
        return 'border-zinc-700 bg-zinc-900';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  const usagePercent = (usage.used / usage.limit) * 100;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Billing & Subscription</h2>
        <p className="text-sm text-zinc-400 mt-1">Manage your subscription and view usage</p>
      </div>

      {/* Current Plan Overview */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-3 ${currentPlan.tier === 'free' ? 'bg-zinc-800' : 'bg-cyan-950/50'} text-cyan-400`}>
                {getTierIcon(currentPlan.tier)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{currentPlan.name}</h3>
                <p className="text-sm text-zinc-400">
                  {currentPlan.tier === 'free' ? 'No subscription' : 'Active subscription'}
                </p>
              </div>
            </div>

            {subscription && (
              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
                {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                  <div className="flex items-center gap-2 text-green-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      Trial ends {new Date(subscription.trial_end).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-white">
              ${currentPlan.price}
              <span className="text-base font-normal text-zinc-400">/mo</span>
            </p>
          </div>
        </div>

        {/* Usage Meter */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-zinc-400">Lead Usage This Month</span>
            <span className="font-medium text-white">
              {usage.used} / {usage.limit} leads
            </span>
          </div>
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-orange-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          {usagePercent >= 90 && (
            <p className="mt-2 text-sm text-orange-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              You're running low on leads. Consider upgrading your plan.
            </p>
          )}
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Choose Your Plan</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentPlan.tier;
            const isUpgrade = PLANS.indexOf(plan) > PLANS.indexOf(currentPlan);

            return (
              <div
                key={plan.tier}
                className={`relative rounded-lg border-2 p-6 transition-all ${
                  isCurrent
                    ? getTierColor(plan.tier) + ' border-2'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500">
                    Current Plan
                  </Badge>
                )}

                {plan.tier === 'pro' && !isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-cyan-400">
                      {getTierIcon(plan.tier)}
                    </div>
                    <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    ${plan.price}
                    <span className="text-base font-normal text-zinc-400">/mo</span>
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">{plan.leads} leads/month</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <Button
                    className="w-full"
                    variant={isUpgrade ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={processingTier === plan.tier || plan.tier === 'free'}
                  >
                    {processingTier === plan.tier ? (
                      'Processing...'
                    ) : isUpgrade ? (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Upgrade Now
                      </>
                    ) : plan.tier === 'free' ? (
                      'Current Plan'
                    ) : (
                      'Select Plan'
                    )}
                  </Button>
                )}

                {isCurrent && plan.tier !== 'free' && (
                  <Button className="w-full" variant="outline" disabled>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trial Banner */}
      {subscription?.trial_end && new Date(subscription.trial_end) > new Date() && (
        <div className="rounded-lg border border-green-800 bg-green-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-green-950/50 p-2 text-green-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Free Trial Active</h4>
              <p className="text-sm text-zinc-300 mt-1">
                You're currently on a 14-day free trial. Your first payment will be charged on{' '}
                <span className="font-medium text-white">
                  {new Date(subscription.trial_end).toLocaleDateString()}
                </span>
                . Cancel anytime before then at no charge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h4 className="font-semibold text-white mb-2">Need Help?</h4>
        <p className="text-sm text-zinc-400 mb-4">
          Have questions about our pricing or need a custom plan? Our team is here to help.
        </p>
        <Button variant="outline" size="sm">
          Contact Sales
        </Button>
      </div>
    </div>
  );
};
