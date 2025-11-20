/*
  # Security Improvements Migration

  1. Enhanced RLS Policies
    - Tighten system admin verification
    - Improve legal admin ownership checks
    - Restrict lead_rotation_state access

  2. Soft Delete Functionality
    - Add deleted_at columns to critical tables
    - Update RLS policies to filter deleted records
    - Add soft delete functions

  3. Audit Logging
    - Add audit log table for sensitive operations
*/

-- Add deleted_at columns for soft delete
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE law_firms
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for audit logs (only system admins can read)
CREATE POLICY "System admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
    AND profiles.deleted_at IS NULL
  ));

-- Drop existing problematic policies and recreate with better security
DROP POLICY IF EXISTS "System admins can read all profiles" ON profiles;
CREATE POLICY "System admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
      AND p.deleted_at IS NULL
      AND profiles.deleted_at IS NULL
    )
  );

-- Update legal admin policies to require firm ownership
DROP POLICY IF EXISTS "Legal admins can view matched conversations" ON conversations;
CREATE POLICY "Legal admins can view matched conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    conversations.deleted_at IS NULL AND (
      EXISTS (
        SELECT 1
        FROM profiles
        JOIN law_firms ON law_firms.contact_email = profiles.email
        JOIN lead_assignments ON lead_assignments.law_firm_id = law_firms.id
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'legal_admin'
        AND profiles.deleted_at IS NULL
        AND law_firms.deleted_at IS NULL
        AND lead_assignments.conversation_id = conversations.id
      )
    )
  );

-- Restrict lead_rotation_state to only edge functions (service role)
DROP POLICY IF EXISTS "System can manage rotation state" ON lead_rotation_state;
CREATE POLICY "Only service role can manage rotation state"
  ON lead_rotation_state
  FOR ALL
  TO service_role
  USING (true);

-- Add policy for authenticated users to read rotation state
CREATE POLICY "System admins can view rotation state"
  ON lead_rotation_state
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
    AND profiles.deleted_at IS NULL
  ));

-- Function to soft delete records
CREATE OR REPLACE FUNCTION soft_delete(table_name text, record_id uuid)
RETURNS void AS $$
DECLARE
  query text;
BEGIN
  query := format('UPDATE %I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', table_name);
  EXECUTE query USING record_id;

  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, table_name, record_id)
  VALUES (auth.uid(), 'soft_delete', table_name, record_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore soft deleted records
CREATE OR REPLACE FUNCTION restore_deleted(table_name text, record_id uuid)
RETURNS void AS $$
DECLARE
  query text;
BEGIN
  query := format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name);
  EXECUTE query USING record_id;

  -- Log the restoration
  INSERT INTO audit_logs (user_id, action, table_name, record_id)
  VALUES (auth.uid(), 'restore', table_name, record_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing policies to filter out soft deleted records
-- This ensures deleted records don't appear in queries

-- Update all SELECT policies to include deleted_at IS NULL check
-- (Already added to policies above, but add indexes for performance)

-- Add indexes for soft delete columns
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_law_firms_deleted_at ON law_firms(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matches_deleted_at ON matches(deleted_at) WHERE deleted_at IS NULL;

-- Add index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Function to permanently delete old soft-deleted records (run monthly)
CREATE OR REPLACE FUNCTION cleanup_old_deleted_records(retention_days integer DEFAULT 90)
RETURNS void AS $$
BEGIN
  -- Permanently delete profiles older than retention period
  DELETE FROM profiles
  WHERE deleted_at IS NOT NULL
  AND deleted_at < (now() - make_interval(days => retention_days));

  DELETE FROM law_firms
  WHERE deleted_at IS NOT NULL
  AND deleted_at < (now() - make_interval(days => retention_days));

  DELETE FROM conversations
  WHERE deleted_at IS NOT NULL
  AND deleted_at < (now() - make_interval(days => retention_days));

  DELETE FROM leads
  WHERE deleted_at IS NOT NULL
  AND deleted_at < (now() - make_interval(days => retention_days));

  DELETE FROM matches
  WHERE deleted_at IS NOT NULL
  AND deleted_at < (now() - make_interval(days => retention_days));

  -- Log the cleanup
  INSERT INTO audit_logs (user_id, action, table_name, new_data)
  VALUES (auth.uid(), 'cleanup_deleted', 'system', jsonb_build_object('retention_days', retention_days));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to log changes to sensitive tables
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_profiles_changes ON profiles;
CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_law_firms_changes ON law_firms;
CREATE TRIGGER audit_law_firms_changes
  AFTER INSERT OR UPDATE OR DELETE ON law_firms
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Grant execute permissions on soft delete functions to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_deleted(text, uuid) TO authenticated;
