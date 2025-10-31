/*
  # Add Tavus Configuration Management

  1. New Tables
    - `tavus_configs`: Stores Tavus API configuration settings
      - `id` (uuid, primary key): Unique identifier
      - `name` (text): Configuration name/identifier
      - `persona_id` (text): Tavus persona ID
      - `custom_greeting` (text): Custom greeting message
      - `conversational_context` (text): AI conversation context
      - `language` (text): Language setting
      - `interrupt_sensitivity` (text): Interrupt sensitivity level
      - `active` (boolean): Whether this config is currently active
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp
      - `created_by` (uuid): User who created the config
      - `updated_by` (uuid): User who last updated the config

  2. Security
    - Enable RLS on tavus_configs table
    - Add policies for system admins to manage configurations
    - Add policies for all authenticated users to read active configurations
*/

-- Create tavus_configs table
CREATE TABLE IF NOT EXISTS tavus_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  persona_id text NOT NULL,
  custom_greeting text,
  conversational_context text,
  language text DEFAULT 'en',
  interrupt_sensitivity text DEFAULT 'medium',
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  CONSTRAINT tavus_configs_name_key UNIQUE (name)
);

-- Enable RLS
ALTER TABLE tavus_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System admins can manage tavus configs"
  ON tavus_configs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
  ));

CREATE POLICY "Authenticated users can read active configs"
  ON tavus_configs
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_tavus_configs_modtime
  BEFORE UPDATE ON tavus_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();