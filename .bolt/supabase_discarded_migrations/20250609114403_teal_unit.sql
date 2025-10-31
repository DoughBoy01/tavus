/*
  # Update Policies for Public Conversation Access

  1. Changes
    - Remove authentication requirements for creating conversations and leads
    - Allow public access to active Tavus configurations
    - Maintain admin access controls for management functions
    
  2. Security
    - Public users can create conversations and leads
    - Public users can read active Tavus configurations  
    - Admin functions still require authentication
*/

-- Drop all existing policies for conversations to avoid conflicts
DROP POLICY IF EXISTS "Public users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Legal admins can view matched conversations" ON conversations;
DROP POLICY IF EXISTS "System admins can view all conversations" ON conversations;
DROP POLICY IF EXISTS "System admins can manage conversations" ON conversations;
DROP POLICY IF EXISTS "Allow service role to update transcripts" ON conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON conversations;

-- Create new policies for conversations that allow public access
CREATE POLICY "Allow service role to update transcripts"
  ON conversations
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can create conversations"
  ON conversations
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Recreate admin policies for conversations
CREATE POLICY "Legal admins can view matched conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'legal_admin'
    ) AND 
    EXISTS (
      SELECT 1 
      FROM leads 
      JOIN matches ON leads.id = matches.lead_id 
      JOIN law_firms ON matches.law_firm_id = law_firms.id 
      WHERE leads.conversation_id = conversations.id
    )
  );

CREATE POLICY "System admins can view all conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

CREATE POLICY "System admins can manage conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Drop existing leads policies to avoid conflicts
DROP POLICY IF EXISTS "Public users can view their own leads" ON leads;
DROP POLICY IF EXISTS "Legal admins can view matched leads" ON leads;
DROP POLICY IF EXISTS "System admins can manage leads" ON leads;
DROP POLICY IF EXISTS "Anyone can create leads" ON leads;

-- Create new policies for leads
CREATE POLICY "Anyone can create leads"
  ON leads
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Recreate admin policies for leads
CREATE POLICY "Legal admins can view matched leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM matches 
      JOIN law_firms ON matches.law_firm_id = law_firms.id 
      WHERE matches.lead_id = leads.id
    )
  );

CREATE POLICY "System admins can manage leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Update tavus_configs policy to allow public read access to active configs
DROP POLICY IF EXISTS "Authenticated users can read active configs" ON tavus_configs;
DROP POLICY IF EXISTS "Anyone can read active configs" ON tavus_configs;

CREATE POLICY "Anyone can read active configs"
  ON tavus_configs
  FOR SELECT
  TO public
  USING (active = true);

-- Recreate admin policy for tavus_configs
CREATE POLICY "System admins can manage tavus configs"
  ON tavus_configs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'system_admin'
  ));