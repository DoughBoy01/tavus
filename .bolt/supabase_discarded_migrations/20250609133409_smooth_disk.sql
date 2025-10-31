-- Drop all existing policies that we plan to create to avoid conflicts
DROP POLICY IF EXISTS "Public users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Allow service role to update transcripts" ON conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON conversations;
DROP POLICY IF EXISTS "Anyone can create leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can read active configs" ON tavus_configs;
DROP POLICY IF EXISTS "Anyone can read active configs" ON tavus_configs;

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

-- Update leads policies to allow public creation
CREATE POLICY "Anyone can create leads"
  ON leads
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Update tavus_configs policy to allow public read access to active configs
CREATE POLICY "Anyone can read active configs"
  ON tavus_configs
  FOR SELECT
  TO public
  USING (active = true);