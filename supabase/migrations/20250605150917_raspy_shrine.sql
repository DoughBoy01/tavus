/*
  # Add Tavus API Key Storage
  
  1. New Table
    - `system_configs`: Stores system-wide configuration values
      - `id` (uuid, primary key): Unique identifier
      - `key` (text): Configuration key name
      - `value` (text): Configuration value
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp
      - `created_by` (uuid): Reference to the user who created the config
      - `updated_by` (uuid): Reference to the user who last updated the config
  
  2. Security
    - Enable RLS
    - Only system admins can manage configurations
    - Authenticated users can read non-sensitive configs
*/

-- Create system_configs table
CREATE TABLE IF NOT EXISTS system_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "System admins can manage system configs"
  ON system_configs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_system_configs_modtime
  BEFORE UPDATE ON system_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- Insert initial Tavus API key config (empty by default)
INSERT INTO system_configs (key, value)
VALUES ('tavus_api_key', '')
ON CONFLICT (key) DO NOTHING;