/*
  # Lead Management System Enhancement

  1. Schema Updates
    - Add missing fields to conversations table (caseCategory, firmLocation, OpenAiUrgencyScore)
    - Add subscription and capacity management to law_firms table
    - Add lead rotation tracking
    - Add billing and subscription tables
    
  2. New Tables
    - `firm_subscriptions`: Track law firm subscription status and billing
    - `lead_assignments`: Track lead distribution and rotation
    - `firm_service_areas`: Define where firms can serve clients
    - `lead_rotation_state`: Track fair rotation state
    
  3. Enhanced Functions
    - Update matching algorithm for fair rotation
    - Add lead distribution logic
*/

-- Add missing fields to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS case_category text,
ADD COLUMN IF NOT EXISTS firm_location text,
ADD COLUMN IF NOT EXISTS openai_urgency_score decimal DEFAULT 5.0;

-- Enhance law_firms table with capacity and subscription fields
ALTER TABLE law_firms 
ADD COLUMN IF NOT EXISTS max_leads_per_month integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS current_month_leads integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
ADD COLUMN IF NOT EXISTS remote_capable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_lead_assigned_at timestamptz;

-- Create firm_subscriptions table for billing management
CREATE TABLE IF NOT EXISTS firm_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  plan_type text NOT NULL DEFAULT 'standard' CHECK (plan_type IN ('trial', 'standard', 'premium', 'enterprise')),
  monthly_fee decimal NOT NULL DEFAULT 199.00,
  max_leads integer NOT NULL DEFAULT 50,
  billing_cycle_start date NOT NULL DEFAULT CURRENT_DATE,
  billing_cycle_end date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create firm_service_areas table
CREATE TABLE IF NOT EXISTS firm_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  state text,
  city text,
  zip_code text,
  radius_miles integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  UNIQUE(law_firm_id, state, city)
);

-- Create lead_assignments table for tracking distribution
CREATE TABLE IF NOT EXISTS lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  match_score decimal DEFAULT 0.0,
  assignment_method text DEFAULT 'auto' CHECK (assignment_method IN ('auto', 'manual', 'rotation')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  assigned_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz DEFAULT (now() + INTERVAL '24 hours'),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lead_rotation_state table for fair distribution
CREATE TABLE IF NOT EXISTS lead_rotation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area_id uuid REFERENCES practice_areas(id) ON DELETE CASCADE NOT NULL,
  location_key text NOT NULL, -- state or city identifier
  last_assigned_firm_id uuid REFERENCES law_firms(id),
  rotation_order jsonb DEFAULT '[]'::jsonb, -- Array of firm IDs in rotation order
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practice_area_id, location_key)
);

-- Enable RLS on new tables
ALTER TABLE firm_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_rotation_state ENABLE ROW LEVEL SECURITY;

-- Policies for firm_subscriptions
CREATE POLICY "Law firms can view own subscriptions"
  ON firm_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    law_firm_id IN (
      SELECT lf.id FROM law_firms lf 
      JOIN profiles p ON p.email = lf.contact_email 
      WHERE p.id = auth.uid() AND p.role = 'legal_admin'
    )
  );

CREATE POLICY "System admins can manage all subscriptions"
  ON firm_subscriptions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'));

-- Policies for firm_service_areas
CREATE POLICY "Law firms can manage own service areas"
  ON firm_service_areas
  FOR ALL
  TO authenticated
  USING (
    law_firm_id IN (
      SELECT lf.id FROM law_firms lf 
      JOIN profiles p ON p.email = lf.contact_email 
      WHERE p.id = auth.uid() AND p.role = 'legal_admin'
    )
  );

CREATE POLICY "Anyone can view service areas for matching"
  ON firm_service_areas
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for lead_assignments
CREATE POLICY "Law firms can view own assignments"
  ON lead_assignments
  FOR SELECT
  TO authenticated
  USING (
    law_firm_id IN (
      SELECT lf.id FROM law_firms lf 
      JOIN profiles p ON p.email = lf.contact_email 
      WHERE p.id = auth.uid() AND p.role = 'legal_admin'
    )
  );

CREATE POLICY "Law firms can update own assignments"
  ON lead_assignments
  FOR UPDATE
  TO authenticated
  USING (
    law_firm_id IN (
      SELECT lf.id FROM law_firms lf 
      JOIN profiles p ON p.email = lf.contact_email 
      WHERE p.id = auth.uid() AND p.role = 'legal_admin'
    )
  );

CREATE POLICY "System admins can manage all assignments"
  ON lead_assignments
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'system_admin'));

-- Policies for lead_rotation_state
CREATE POLICY "System can manage rotation state"
  ON lead_rotation_state
  FOR ALL
  TO authenticated
  USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_firm_subscriptions_modtime
  BEFORE UPDATE ON firm_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_lead_assignments_modtime
  BEFORE UPDATE ON lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Enhanced lead matching and distribution function
CREATE OR REPLACE FUNCTION distribute_lead_with_rotation(conversation_id uuid)
RETURNS void AS $$
DECLARE
  v_case_category text;
  v_firm_location text;
  v_urgency_score decimal;
  v_practice_area_id uuid;
  v_location_key text;
  v_rotation_state RECORD;
  v_eligible_firms uuid[];
  v_selected_firm_id uuid;
  v_rotation_order jsonb;
  firm_record RECORD;
BEGIN
  -- Get conversation details
  SELECT 
    case_category, 
    firm_location, 
    COALESCE(openai_urgency_score, urgency_score::decimal) as urgency_score
  INTO 
    v_case_category, 
    v_firm_location, 
    v_urgency_score
  FROM conversations 
  WHERE id = conversation_id;

  -- Get practice area ID
  SELECT id INTO v_practice_area_id 
  FROM practice_areas 
  WHERE LOWER(name) = LOWER(v_case_category)
  LIMIT 1;

  -- If no practice area found, use a default or skip
  IF v_practice_area_id IS NULL THEN
    RETURN;
  END IF;

  -- Create location key (state from firm_location)
  v_location_key := COALESCE(SPLIT_PART(v_firm_location, ',', -1), 'unknown');
  v_location_key := TRIM(v_location_key);

  -- Find eligible firms based on:
  -- 1. Active subscription
  -- 2. Practice area match
  -- 3. Service area match or remote capable
  -- 4. Under capacity limits
  SELECT array_agg(lf.id) INTO v_eligible_firms
  FROM law_firms lf
  JOIN law_firm_practice_areas lfpa ON lf.id = lfpa.law_firm_id
  WHERE lfpa.practice_area_id = v_practice_area_id
    AND lf.subscription_status = 'active'
    AND lf.current_month_leads < lf.max_leads_per_month
    AND (
      lf.remote_capable = true 
      OR EXISTS (
        SELECT 1 FROM firm_service_areas fsa 
        WHERE fsa.law_firm_id = lf.id 
        AND (fsa.state = v_location_key OR fsa.city ILIKE '%' || v_firm_location || '%')
      )
    );

  -- If no eligible firms, return
  IF array_length(v_eligible_firms, 1) IS NULL OR array_length(v_eligible_firms, 1) = 0 THEN
    RETURN;
  END IF;

  -- Get or create rotation state
  SELECT * INTO v_rotation_state
  FROM lead_rotation_state
  WHERE practice_area_id = v_practice_area_id 
    AND location_key = v_location_key;

  IF v_rotation_state IS NULL THEN
    -- Create new rotation state
    INSERT INTO lead_rotation_state (practice_area_id, location_key, rotation_order)
    VALUES (v_practice_area_id, v_location_key, to_jsonb(v_eligible_firms))
    RETURNING * INTO v_rotation_state;
  END IF;

  -- Update rotation order to include new eligible firms
  v_rotation_order := to_jsonb(v_eligible_firms);

  -- Find next firm in rotation
  IF v_rotation_state.last_assigned_firm_id IS NULL THEN
    v_selected_firm_id := v_eligible_firms[1];
  ELSE
    -- Find current position and get next
    DECLARE
      current_pos integer;
      next_pos integer;
    BEGIN
      SELECT position - 1 INTO current_pos
      FROM unnest(v_eligible_firms) WITH ORDINALITY AS t(firm_id, position)
      WHERE firm_id = v_rotation_state.last_assigned_firm_id;

      IF current_pos IS NULL THEN
        v_selected_firm_id := v_eligible_firms[1];
      ELSE
        next_pos := (current_pos % array_length(v_eligible_firms, 1)) + 1;
        v_selected_firm_id := v_eligible_firms[next_pos];
      END IF;
    END;
  END IF;

  -- Create lead assignment
  INSERT INTO lead_assignments (
    conversation_id,
    law_firm_id,
    match_score,
    assignment_method,
    status
  ) VALUES (
    conversation_id,
    v_selected_firm_id,
    1.0, -- Full score for rotation assignment
    'rotation',
    'pending'
  );

  -- Update rotation state
  UPDATE lead_rotation_state
  SET 
    last_assigned_firm_id = v_selected_firm_id,
    rotation_order = v_rotation_order,
    updated_at = now()
  WHERE practice_area_id = v_practice_area_id 
    AND location_key = v_location_key;

  -- Update firm's lead count
  UPDATE law_firms
  SET 
    current_month_leads = current_month_leads + 1,
    last_lead_assigned_at = now()
  WHERE id = v_selected_firm_id;

  -- Update conversation status
  UPDATE conversations 
  SET status = 'matched'
  WHERE id = conversation_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Error in distribute_lead_with_rotation: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to handle lead responses
CREATE OR REPLACE FUNCTION handle_lead_response(assignment_id uuid, response_status text, reason text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  -- Get assignment details
  SELECT * INTO v_assignment
  FROM lead_assignments
  WHERE id = assignment_id;

  -- Update assignment
  UPDATE lead_assignments
  SET 
    status = response_status,
    responded_at = now(),
    rejection_reason = CASE WHEN response_status = 'rejected' THEN reason ELSE NULL END
  WHERE id = assignment_id;

  -- If rejected, try to redistribute
  IF response_status = 'rejected' THEN
    -- Mark current assignment as rejected but keep for tracking
    -- Try to redistribute to next firm
    PERFORM distribute_lead_with_rotation(v_assignment.conversation_id);
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly lead counts (to be called monthly)
CREATE OR REPLACE FUNCTION reset_monthly_lead_counts()
RETURNS void AS $$
BEGIN
  UPDATE law_firms 
  SET current_month_leads = 0
  WHERE EXTRACT(DAY FROM now()) = 1; -- Reset on first day of month
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically distribute leads when conversations are processed
CREATE OR REPLACE FUNCTION trigger_lead_distribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Only distribute if status changed to 'processed' and we have case category
  IF NEW.status = 'processed' AND NEW.case_category IS NOT NULL AND 
     (OLD IS NULL OR OLD.status != 'processed') THEN
    PERFORM distribute_lead_with_rotation(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to conversations table
DROP TRIGGER IF EXISTS distribute_lead_trigger ON conversations;
CREATE TRIGGER distribute_lead_trigger
  AFTER UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lead_distribution();

-- Insert initial practice areas if they don't exist
INSERT INTO practice_areas (name, description) VALUES
('Personal Injury', 'Accidents, medical malpractice, wrongful death'),
('Family Law', 'Divorce, custody, adoption, domestic relations'),
('Criminal Defense', 'Criminal charges, DUI, traffic violations'),
('Immigration', 'Visas, citizenship, deportation defense'),
('Estate Planning', 'Wills, trusts, probate, estate administration'),
('Business Law', 'Corporate formation, contracts, commercial litigation'),
('Real Estate', 'Property transactions, landlord-tenant, real estate disputes'),
('Employment Law', 'Workplace discrimination, wrongful termination, labor disputes'),
('Bankruptcy', 'Chapter 7, Chapter 13, debt relief'),
('Intellectual Property', 'Patents, trademarks, copyrights')
ON CONFLICT (name) DO NOTHING;