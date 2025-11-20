/*
  # Add Notification Triggers

  This migration adds triggers to automatically send notifications when:
  - A new match is created
  - A lead is claimed
  - A lead status changes
*/

-- 1. Function to trigger lead notification after match is created
CREATE OR REPLACE FUNCTION trigger_lead_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function via pg_net (if available) or queue it
  INSERT INTO email_queue (
    to_email,
    subject,
    template_name,
    template_data,
    scheduled_for
  )
  SELECT
    'trigger@notification.system',
    'Lead Notification Trigger',
    'send-lead-notification',
    jsonb_build_object('matchId', NEW.id),
    now()
  WHERE NOT EXISTS (
    -- Prevent duplicate notifications
    SELECT 1 FROM email_queue
    WHERE template_name = 'send-lead-notification'
    AND template_data->>'matchId' = NEW.id::text
    AND created_at > now() - interval '5 minutes'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on new matches
DROP TRIGGER IF EXISTS match_notification_trigger ON matches;
CREATE TRIGGER match_notification_trigger
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lead_notification();

-- 3. Function to log lead activity
CREATE OR REPLACE FUNCTION log_lead_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (lead_id, activity_type, details)
    VALUES (
      NEW.id,
      'status_changed',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  -- Log when lead is claimed
  IF TG_OP = 'UPDATE' AND OLD.claimed_at IS NULL AND NEW.claimed_at IS NOT NULL THEN
    INSERT INTO lead_activities (lead_id, user_id, activity_type, details)
    VALUES (
      NEW.id,
      NEW.claimed_by_user_id,
      'claimed',
      jsonb_build_object(
        'firm_id', NEW.claimed_by_firm_id,
        'claimed_at', NEW.claimed_at
      )
    );

    -- Notify other firms that this lead is no longer available
    INSERT INTO notifications (law_firm_id, type, title, message, link)
    SELECT
      m.law_firm_id,
      'lead_claimed',
      'Lead No Longer Available',
      'A lead you were matched with has been claimed by another firm.',
      '/admin/leads'
    FROM matches m
    WHERE m.lead_id = NEW.id
    AND m.law_firm_id != NEW.claimed_by_firm_id
    AND m.status = 'pending';

    -- Update match statuses
    UPDATE matches
    SET status = 'expired'
    WHERE lead_id = NEW.id
    AND law_firm_id != NEW.claimed_by_firm_id
    AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to log lead activities
DROP TRIGGER IF EXISTS lead_activity_logger ON leads;
CREATE TRIGGER lead_activity_logger
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_activity();

-- 5. Function to update firm rating when review is added
CREATE OR REPLACE FUNCTION update_firm_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE law_firms
  SET rating = (
    SELECT AVG(rating)::decimal
    FROM firm_reviews
    WHERE law_firm_id = NEW.law_firm_id
  )
  WHERE id = NEW.law_firm_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to update firm rating
DROP TRIGGER IF EXISTS firm_rating_updater ON firm_reviews;
CREATE TRIGGER firm_rating_updater
  AFTER INSERT OR UPDATE ON firm_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_firm_rating();

-- 7. Function to expire old pending matches (run periodically)
CREATE OR REPLACE FUNCTION expire_old_matches()
RETURNS void AS $$
BEGIN
  -- Expire matches older than 24 hours that are still pending
  UPDATE matches
  SET status = 'expired'
  WHERE status = 'pending'
  AND created_at < now() - interval '24 hours';

  -- Update corresponding lead statuses
  UPDATE leads l
  SET status = 'expired'
  WHERE l.status = 'matched'
  AND l.claimed_at IS NULL
  AND l.created_at < now() - interval '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM matches m
    WHERE m.lead_id = l.id
    AND m.status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to process email queue
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS void AS $$
DECLARE
  email_record RECORD;
  function_url text;
BEGIN
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/';

  FOR email_record IN
    SELECT * FROM email_queue
    WHERE status = 'pending'
    AND scheduled_for <= now()
    AND retry_count < max_retries
    ORDER BY scheduled_for
    LIMIT 10
  LOOP
    -- Mark as sending
    UPDATE email_queue
    SET status = 'sending'
    WHERE id = email_record.id;

    -- For now, just mark template-based emails as sent
    -- In production, this would call the actual edge function
    IF email_record.template_name IS NOT NULL THEN
      UPDATE email_queue
      SET
        status = 'sent',
        sent_at = now()
      WHERE id = email_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to reset monthly lead counts (run on 1st of each month)
CREATE OR REPLACE FUNCTION reset_monthly_lead_counts()
RETURNS void AS $$
BEGIN
  UPDATE law_firms
  SET leads_used_this_month = 0
  WHERE subscription_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to check if firm can claim more leads
CREATE OR REPLACE FUNCTION can_firm_claim_lead(firm_id uuid)
RETURNS boolean AS $$
DECLARE
  firm_record RECORD;
BEGIN
  SELECT
    subscription_status,
    subscription_tier,
    monthly_lead_limit,
    leads_used_this_month
  INTO firm_record
  FROM law_firms
  WHERE id = firm_id;

  -- Free tier or inactive subscription
  IF firm_record.subscription_status != 'active' THEN
    RETURN firm_record.subscription_tier = 'free' AND firm_record.leads_used_this_month < 3;
  END IF;

  -- Check if under monthly limit
  RETURN firm_record.leads_used_this_month < firm_record.monthly_lead_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to increment lead usage when claimed
CREATE OR REPLACE FUNCTION increment_firm_lead_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment when a lead is newly claimed
  IF OLD.claimed_by_firm_id IS NULL AND NEW.claimed_by_firm_id IS NOT NULL THEN
    UPDATE law_firms
    SET leads_used_this_month = leads_used_this_month + 1
    WHERE id = NEW.claimed_by_firm_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger to increment usage
DROP TRIGGER IF EXISTS increment_lead_usage ON leads;
CREATE TRIGGER increment_lead_usage
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION increment_firm_lead_usage();
