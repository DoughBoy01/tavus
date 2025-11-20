/*
  # Fix Schema Issues - Add Missing Columns

  This migration adds all missing columns identified in the assessment:
  - Adds missing columns to conversations table
  - Adds lead claiming columns
  - Adds subscription tracking to law_firms
  - Creates notifications table
  - Creates email queue table
  - Creates firm metrics table
  - Creates subscriptions table
  - Creates lead activities table
  - Creates firm reviews table
  - Creates lead pricing table
  - Adds necessary indexes for performance
*/

-- 1. Add missing columns to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS case_category text,
ADD COLUMN IF NOT EXISTS firm_location text,
ADD COLUMN IF NOT EXISTS openai_urgency_score integer;

-- 2. Add lead claiming and value tracking columns
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS lead_value decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS claimed_at timestamp,
ADD COLUMN IF NOT EXISTS claimed_by_firm_id uuid REFERENCES law_firms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quality_score decimal,
ADD COLUMN IF NOT EXISTS temperature text DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold'));

-- 3. Add subscription and billing columns to law_firms
ALTER TABLE law_firms
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'cancelled', 'trialing')),
ADD COLUMN IF NOT EXISTS monthly_lead_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS leads_used_this_month integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp,
ADD COLUMN IF NOT EXISTS subscription_started_at timestamp,
ADD COLUMN IF NOT EXISTS avg_response_time_minutes integer,
ADD COLUMN IF NOT EXISTS total_leads_converted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating decimal DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

-- 4. Add law_firm_id to profiles for legal admins
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS law_firm_id uuid REFERENCES law_firms(id) ON DELETE SET NULL;

-- 5. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('lead_matched', 'lead_claimed', 'payment_due', 'subscription_expiring', 'new_review', 'lead_expired', 'lead_converted')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  read_at timestamp,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 6. Create email queue table for reliable email delivery
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_name text,
  template_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  sent_at timestamp,
  error text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  scheduled_for timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

-- 7. Create subscriptions table for detailed subscription tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL,
  plan_tier text NOT NULL CHECK (plan_tier IN ('free', 'basic', 'pro', 'enterprise')),
  status text NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing', 'paused')),
  current_period_start timestamp NOT NULL,
  current_period_end timestamp NOT NULL,
  cancel_at timestamp,
  cancelled_at timestamp,
  trial_start timestamp,
  trial_end timestamp,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  amount decimal NOT NULL DEFAULT 0,
  currency text DEFAULT 'usd',
  interval text DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 8. Create lead_activities table for audit trail
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('created', 'matched', 'claimed', 'contacted', 'note_added', 'status_changed', 'email_sent', 'call_made', 'meeting_scheduled', 'converted', 'lost')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now()
);

-- 9. Create firm_metrics table for performance tracking
CREATE TABLE IF NOT EXISTS firm_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  metric_date date NOT NULL,
  leads_received integer DEFAULT 0,
  leads_claimed integer DEFAULT 0,
  leads_contacted integer DEFAULT 0,
  leads_converted integer DEFAULT 0,
  avg_response_time_minutes integer,
  revenue_generated decimal DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(law_firm_id, metric_date)
);

-- 10. Create firm_reviews table for ratings and feedback
CREATE TABLE IF NOT EXISTS firm_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  reviewer_email text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  response_time_rating integer CHECK (response_time_rating >= 1 AND response_time_rating <= 5),
  professionalism_rating integer CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  would_recommend boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 11. Create lead_pricing table for dynamic pricing
CREATE TABLE IF NOT EXISTS lead_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area_id uuid REFERENCES practice_areas(id) ON DELETE CASCADE NOT NULL,
  urgency_level text NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
  base_price decimal NOT NULL DEFAULT 25,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(practice_area_id, urgency_level)
);

-- 12. Create messages table for communication hub
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'firm', 'system')),
  recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  read_at timestamp,
  created_at timestamp DEFAULT now()
);

-- 13. Create appointments table for scheduling
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  scheduled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for timestamp NOT NULL,
  duration_minutes integer DEFAULT 30,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  meeting_type text DEFAULT 'consultation' CHECK (meeting_type IN ('consultation', 'follow_up', 'signing', 'other')),
  meeting_link text,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 14. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_firm ON notifications(law_firm_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_claimed_firm ON leads(claimed_by_firm_id, claimed_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_category ON conversations(case_category);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_urgency ON conversations(urgency_score DESC);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_appointments_firm ON appointments(law_firm_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);

-- 15. Enable RLS on all new tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 16. RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Legal admins can view firm notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'legal_admin'
      AND profiles.law_firm_id = notifications.law_firm_id
    )
  );

CREATE POLICY "Users can mark their notifications as read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 17. RLS Policies for subscriptions
CREATE POLICY "System admins can view all subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "Legal admins can view their firm subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'legal_admin'
      AND profiles.law_firm_id = subscriptions.law_firm_id
    )
  );

-- 18. RLS Policies for lead_activities
CREATE POLICY "System admins can view all activities"
  ON lead_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "Legal admins can view activities for their leads"
  ON lead_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN matches m ON m.lead_id = l.id
      JOIN profiles p ON p.id = auth.uid()
      WHERE l.id = lead_activities.lead_id
      AND p.role = 'legal_admin'
      AND p.law_firm_id = m.law_firm_id
    )
  );

CREATE POLICY "Legal admins can create activities for their leads"
  ON lead_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN profiles p ON p.id = auth.uid()
      WHERE l.id = lead_activities.lead_id
      AND p.role = 'legal_admin'
      AND l.claimed_by_firm_id = p.law_firm_id
    )
  );

-- 19. RLS Policies for firm_metrics
CREATE POLICY "System admins can view all metrics"
  ON firm_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "Legal admins can view their firm metrics"
  ON firm_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'legal_admin'
      AND profiles.law_firm_id = firm_metrics.law_firm_id
    )
  );

-- 20. RLS Policies for firm_reviews
CREATE POLICY "Anyone can view firm reviews"
  ON firm_reviews FOR SELECT
  USING (true);

CREATE POLICY "System admins can manage reviews"
  ON firm_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- 21. RLS Policies for lead_pricing
CREATE POLICY "Anyone can view lead pricing"
  ON lead_pricing FOR SELECT
  USING (true);

CREATE POLICY "System admins can manage pricing"
  ON lead_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- 22. RLS Policies for messages
CREATE POLICY "Users can view messages they sent or received"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id);

-- 23. RLS Policies for appointments
CREATE POLICY "System admins can view all appointments"
  ON appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "Legal admins can view their firm appointments"
  ON appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'legal_admin'
      AND profiles.law_firm_id = appointments.law_firm_id
    )
  );

CREATE POLICY "Legal admins can create appointments for their leads"
  ON appointments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN profiles p ON p.id = auth.uid()
      WHERE l.id = appointments.lead_id
      AND p.role = 'legal_admin'
      AND l.claimed_by_firm_id = p.law_firm_id
    )
  );

-- 24. Create function to update firm metrics daily
CREATE OR REPLACE FUNCTION update_firm_metrics()
RETURNS void AS $$
DECLARE
  firm RECORD;
  yesterday DATE := CURRENT_DATE - 1;
BEGIN
  FOR firm IN SELECT id FROM law_firms LOOP
    INSERT INTO firm_metrics (
      law_firm_id,
      metric_date,
      leads_received,
      leads_claimed,
      leads_contacted,
      leads_converted,
      avg_response_time_minutes
    )
    SELECT
      firm.id,
      yesterday,
      COUNT(DISTINCT m.lead_id) FILTER (WHERE m.created_at::date = yesterday),
      COUNT(DISTINCT l.id) FILTER (WHERE l.claimed_at::date = yesterday AND l.claimed_by_firm_id = firm.id),
      COUNT(DISTINCT la.lead_id) FILTER (WHERE la.created_at::date = yesterday AND la.activity_type = 'contacted'),
      COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted' AND l.updated_at::date = yesterday),
      AVG(EXTRACT(EPOCH FROM (l.claimed_at - l.created_at))/60)::integer
    FROM law_firms lf
    LEFT JOIN matches m ON m.law_firm_id = lf.id
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN lead_activities la ON la.lead_id = l.id
    WHERE lf.id = firm.id
    GROUP BY lf.id
    ON CONFLICT (law_firm_id, metric_date)
    DO UPDATE SET
      leads_received = EXCLUDED.leads_received,
      leads_claimed = EXCLUDED.leads_claimed,
      leads_contacted = EXCLUDED.leads_contacted,
      leads_converted = EXCLUDED.leads_converted,
      avg_response_time_minutes = EXCLUDED.avg_response_time_minutes,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 25. Insert default lead pricing
INSERT INTO lead_pricing (practice_area_id, urgency_level, base_price)
SELECT id, 'low', 25 FROM practice_areas
ON CONFLICT DO NOTHING;

INSERT INTO lead_pricing (practice_area_id, urgency_level, base_price)
SELECT id, 'medium', 50 FROM practice_areas
ON CONFLICT DO NOTHING;

INSERT INTO lead_pricing (practice_area_id, urgency_level, base_price)
SELECT id, 'high', 100 FROM practice_areas
ON CONFLICT DO NOTHING;

INSERT INTO lead_pricing (practice_area_id, urgency_level, base_price)
SELECT id, 'urgent', 200 FROM practice_areas
ON CONFLICT DO NOTHING;
