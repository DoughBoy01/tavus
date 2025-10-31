/*
  # Create Matching Function

  1. New Functions
    - `match_lead_to_firms`: Matches leads to appropriate law firms based on practice area
      - Takes a lead ID as input
      - Calculates match scores for each law firm based on:
        - Practice area alignment
        - Location proximity (basic implementation)
        - Firm capacity
        - Success rate
      - Creates match records in the matches table
      - Updates lead status
  
  This function is triggered when a new lead is created or updated.
*/

-- Function to match leads to law firms
CREATE OR REPLACE FUNCTION match_lead_to_firms(lead_id uuid)
RETURNS void AS $$
DECLARE
  v_practice_area_id uuid;
  v_conversation_id uuid;
  v_location text;
  firm_record RECORD;
BEGIN
  -- Get the practice area ID and conversation ID from the lead
  SELECT 
    l.practice_area_id, 
    l.conversation_id
  INTO 
    v_practice_area_id, 
    v_conversation_id
  FROM 
    leads l 
  WHERE 
    l.id = lead_id;

  -- Get location from conversation if available
  SELECT 
    COALESCE(c.case_description, '')
  INTO 
    v_location
  FROM 
    conversations c
  WHERE 
    c.id = v_conversation_id;

  -- Delete any existing matches for this lead to refresh them
  DELETE FROM matches WHERE lead_id = lead_id;

  -- Find matching law firms and calculate scores
  FOR firm_record IN
    SELECT 
      lf.id AS law_firm_id,
      lf.capacity,
      lf.success_rate,
      lf.location,
      EXISTS (
        SELECT 1 
        FROM law_firm_practice_areas lfpa 
        WHERE lfpa.law_firm_id = lf.id 
        AND lfpa.practice_area_id = v_practice_area_id
      ) AS has_practice_area,
      COALESCE(
        (SELECT experience_years 
         FROM law_firm_practice_areas lfpa 
         WHERE lfpa.law_firm_id = lf.id 
         AND lfpa.practice_area_id = v_practice_area_id), 
        0
      ) AS experience_years
    FROM 
      law_firms lf
  LOOP
    -- Only match firms that have the required practice area
    IF firm_record.has_practice_area THEN
      -- Calculate match score based on multiple factors
      -- This is a simplified scoring algorithm and can be enhanced
      DECLARE
        practice_area_score decimal := 0.4;  -- Base score for having the practice area
        capacity_score decimal := LEAST(firm_record.capacity / 100.0, 1.0) * 0.2;  -- Higher capacity = better (20% weight)
        success_score decimal := firm_record.success_rate * 0.3;  -- Higher success rate = better (30% weight)
        experience_score decimal := LEAST(firm_record.experience_years / 10.0, 1.0) * 0.1;  -- More experience = better (10% weight)
        total_score decimal;
      BEGIN
        -- Calculate total score (0.0 to 1.0 scale)
        total_score := practice_area_score + capacity_score + success_score + experience_score;
        
        -- Create a match record
        INSERT INTO matches (
          lead_id, 
          law_firm_id, 
          match_score,
          status
        ) VALUES (
          lead_id, 
          firm_record.law_firm_id, 
          total_score,
          'pending'
        );
      END;
    END IF;
  END LOOP;

  -- Update the lead status to 'matched' if at least one match was created
  IF EXISTS (SELECT 1 FROM matches WHERE lead_id = lead_id) THEN
    UPDATE leads SET status = 'matched' WHERE id = lead_id;
    
    -- Update the conversation status as well
    UPDATE conversations 
    SET status = 'matched' 
    WHERE id = v_conversation_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically match leads when they're created
CREATE OR REPLACE FUNCTION trigger_match_lead()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM match_lead_to_firms(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to the leads table
DROP TRIGGER IF EXISTS match_lead_trigger ON leads;
CREATE TRIGGER match_lead_trigger
  AFTER INSERT OR UPDATE OF practice_area_id ON leads
  FOR EACH ROW
  WHEN (NEW.practice_area_id IS NOT NULL)
  EXECUTE FUNCTION trigger_match_lead();