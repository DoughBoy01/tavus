/*
  # Initial Legal Lead Generation Platform Schema

  1. New Tables
    - `profiles`: Stores user profiles for all user types
      - `id` (uuid, primary key): Matches the auth.users id
      - `email` (text): User's email address
      - `first_name` (text): User's first name
      - `last_name` (text): User's last name
      - `role` (text): User role (public, legal_admin, system_admin)
      - `created_at` (timestamptz): Profile creation timestamp
      - `updated_at` (timestamptz): Profile update timestamp
    
    - `law_firms`: Stores law firm information
      - `id` (uuid, primary key): Unique identifier
      - `name` (text): Law firm name
      - `description` (text): Description of the firm
      - `location` (text): Location of the firm
      - `website` (text): Firm website
      - `contact_email` (text): Contact email
      - `contact_phone` (text): Contact phone number
      - `capacity` (integer): Current capacity to take on new clients
      - `success_rate` (decimal): Success rate percentage
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp

    - `practice_areas`: Legal practice areas
      - `id` (uuid, primary key): Unique identifier
      - `name` (text): Name of practice area
      - `description` (text): Description of practice area
      - `created_at` (timestamptz): Creation timestamp
    
    - `law_firm_practice_areas`: Junction table for law firms and practice areas
      - `id` (uuid, primary key): Unique identifier
      - `law_firm_id` (uuid): Foreign key to law_firms
      - `practice_area_id` (uuid): Foreign key to practice_areas
      - `experience_years` (integer): Years of experience in this practice area
      - `created_at` (timestamptz): Creation timestamp
    
    - `conversations`: Stores conversation data from Tavus
      - `id` (uuid, primary key): Unique identifier
      - `tavus_conversation_id` (text): Tavus conversation ID
      - `user_id` (uuid, nullable): Foreign key to profiles if user is registered
      - `name` (text): Name of the person seeking legal help
      - `email` (text): Email of the person seeking legal help
      - `phone` (text): Phone of the person seeking legal help
      - `case_description` (text): Description of the legal case
      - `urgency_score` (integer): Calculated urgency score (1-10)
      - `status` (text): Status of the conversation (new, processed, matched)
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp

    - `leads`: Generated leads from conversations
      - `id` (uuid, primary key): Unique identifier
      - `conversation_id` (uuid): Foreign key to conversations
      - `practice_area_id` (uuid): Foreign key to practice_areas
      - `user_id` (uuid): Foreign key to the public user
      - `status` (text): Status of the lead (new, contacted, converted, closed)
      - `notes` (text): Additional notes
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp

    - `matches`: Matches between leads and law firms
      - `id` (uuid, primary key): Unique identifier
      - `lead_id` (uuid): Foreign key to leads
      - `law_firm_id` (uuid): Foreign key to law_firms
      - `match_score` (decimal): Calculated match score
      - `status` (text): Status of the match (pending, accepted, rejected)
      - `created_at` (timestamptz): Creation timestamp
      - `updated_at` (timestamptz): Update timestamp
    
  2. Security
    - Enable RLS on all tables
    - Create appropriate policies for each user role
*/

-- Create profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'public' CHECK (role IN ('public', 'legal_admin', 'system_admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create law_firms table
CREATE TABLE IF NOT EXISTS law_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text NOT NULL,
  website text,
  contact_email text NOT NULL,
  contact_phone text,
  capacity integer DEFAULT 100,
  success_rate decimal DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create practice_areas table
CREATE TABLE IF NOT EXISTS practice_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create law_firm_practice_areas junction table
CREATE TABLE IF NOT EXISTS law_firm_practice_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id uuid REFERENCES law_firms ON DELETE CASCADE NOT NULL,
  practice_area_id uuid REFERENCES practice_areas ON DELETE CASCADE NOT NULL,
  experience_years integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(law_firm_id, practice_area_id)
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tavus_conversation_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  case_description text,
  urgency_score integer DEFAULT 5,
  status text DEFAULT 'new' CHECK (status IN ('new', 'processed', 'matched')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  practice_area_id uuid REFERENCES practice_areas(id),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  law_firm_id uuid REFERENCES law_firms(id) ON DELETE CASCADE NOT NULL,
  match_score decimal DEFAULT 0.0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_firm_practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Public users can read own profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Public users can update own profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Legal admins can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND role = 'legal_admin');

CREATE POLICY "System admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (role = 'system_admin');

-- Create policies for law_firms
CREATE POLICY "Anyone can view law firms"
  ON law_firms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins can manage law firms"
  ON law_firms
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Create policies for practice_areas
CREATE POLICY "Anyone can view practice areas"
  ON practice_areas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins can manage practice areas"
  ON practice_areas
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Create policies for law_firm_practice_areas
CREATE POLICY "Anyone can view law firm practice areas"
  ON law_firm_practice_areas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins can manage law firm practice areas"
  ON law_firm_practice_areas
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Create policies for conversations
CREATE POLICY "Public users can view their own conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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

-- Create policies for leads
CREATE POLICY "Public users can view their own leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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

-- Create policies for matches
CREATE POLICY "Legal admins can view their matches"
  ON matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM law_firms 
      WHERE law_firms.id = matches.law_firm_id
    )
  );

CREATE POLICY "Legal admins can update their matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM law_firms 
      WHERE law_firms.id = matches.law_firm_id
    )
  );

CREATE POLICY "System admins can manage matches"
  ON matches
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'));

-- Create or replace function to handle updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_law_firms_modtime
    BEFORE UPDATE ON law_firms
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_conversations_modtime
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_leads_modtime
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_matches_modtime
    BEFORE UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Insert initial practice areas
INSERT INTO practice_areas (name, description) 
VALUES 
('Personal Injury', 'Legal cases involving injuries caused by accidents or negligence'),
('Family Law', 'Legal issues related to family relationships, divorce, child custody, etc.'),
('Criminal Defense', 'Legal representation for individuals charged with crimes'),
('Immigration', 'Legal matters regarding citizenship, visas, and immigration status'),
('Estate Planning', 'Preparing for the transfer of a person''s wealth and assets after death'),
('Business Law', 'Legal services for businesses, including formation, contracts, and disputes'),
('Intellectual Property', 'Legal protection for creations of the mind, such as patents and copyrights'),
('Employment Law', 'Legal issues related to employment relationships and workplace rights'),
('Real Estate', 'Legal matters involving property, land, and real estate transactions'),
('Tax Law', 'Legal counsel on tax matters and disputes with tax authorities')
ON CONFLICT (name) DO NOTHING;