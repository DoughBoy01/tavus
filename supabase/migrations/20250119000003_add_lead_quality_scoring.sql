/*
  # Add Intelligent Lead Quality Scoring

  This migration adds a function to calculate lead quality scores based on multiple factors:
  - Information completeness
  - Urgency score
  - Case complexity indicators
  - Response rate likelihood
  - Estimated case value
*/

-- Function to calculate lead quality score
CREATE OR REPLACE FUNCTION calculate_lead_quality_score(lead_conversation_id uuid)
RETURNS decimal AS $$
DECLARE
  conversation_record RECORD;
  quality_score decimal := 0;
  completeness_score decimal := 0;
  urgency_bonus decimal := 0;
  complexity_bonus decimal := 0;
  final_score decimal;
BEGIN
  -- Get conversation data
  SELECT
    name,
    email,
    phone,
    case_description,
    case_category,
    urgency_score,
    openai_urgency_score
  INTO conversation_record
  FROM conversations
  WHERE id = lead_conversation_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 1. Information Completeness (0-40 points)
  -- Name provided: +10
  IF conversation_record.name IS NOT NULL AND LENGTH(conversation_record.name) > 0 THEN
    completeness_score := completeness_score + 10;
  END IF;

  -- Email provided: +10
  IF conversation_record.email IS NOT NULL AND conversation_record.email LIKE '%@%.%' THEN
    completeness_score := completeness_score + 10;
  END IF;

  -- Phone provided: +10
  IF conversation_record.phone IS NOT NULL AND LENGTH(conversation_record.phone) >= 10 THEN
    completeness_score := completeness_score + 10;
  END IF;

  -- Case description quality: +10 (based on length and detail)
  IF conversation_record.case_description IS NOT NULL THEN
    IF LENGTH(conversation_record.case_description) > 100 THEN
      completeness_score := completeness_score + 10;
    ELSIF LENGTH(conversation_record.case_description) > 50 THEN
      completeness_score := completeness_score + 5;
    ELSIF LENGTH(conversation_record.case_description) > 20 THEN
      completeness_score := completeness_score + 2;
    END IF;
  END IF;

  -- 2. Urgency Bonus (0-20 points)
  -- Higher urgency often indicates serious cases and motivated clients
  DECLARE
    urgency_value integer;
  BEGIN
    urgency_value := COALESCE(conversation_record.urgency_score, conversation_record.openai_urgency_score, 5);

    IF urgency_value >= 8 THEN
      urgency_bonus := 20;
    ELSIF urgency_value >= 6 THEN
      urgency_bonus := 15;
    ELSIF urgency_value >= 4 THEN
      urgency_bonus := 10;
    ELSE
      urgency_bonus := 5;
    END IF;
  END;

  -- 3. Case Complexity/Value Indicators (0-25 points)
  -- Certain keywords indicate higher-value cases
  IF conversation_record.case_description IS NOT NULL THEN
    DECLARE
      description_lower text := LOWER(conversation_record.case_description);
    BEGIN
      -- High-value case indicators
      IF description_lower LIKE '%serious%' OR
         description_lower LIKE '%severe%' OR
         description_lower LIKE '%major%' OR
         description_lower LIKE '%significant%' THEN
        complexity_bonus := complexity_bonus + 8;
      END IF;

      -- Financial indicators
      IF description_lower LIKE '%$%' OR
         description_lower LIKE '%dollar%' OR
         description_lower LIKE '%money%' OR
         description_lower LIKE '%compensation%' OR
         description_lower LIKE '%damages%' THEN
        complexity_bonus := complexity_bonus + 7;
      END IF;

      -- Complexity indicators
      IF description_lower LIKE '%multiple%' OR
         description_lower LIKE '%complex%' OR
         description_lower LIKE '%complicated%' OR
         description_lower LIKE '%several%' THEN
        complexity_bonus := complexity_bonus + 5;
      END IF;

      -- Urgency action words
      IF description_lower LIKE '%immediately%' OR
         description_lower LIKE '%asap%' OR
         description_lower LIKE '%urgent%' OR
         description_lower LIKE '%emergency%' THEN
        complexity_bonus := complexity_bonus + 5;
      END IF;

      -- Cap complexity bonus at 25
      IF complexity_bonus > 25 THEN
        complexity_bonus := 25;
      END IF;
    END;
  END IF;

  -- 4. Category Bonus (0-15 points)
  -- Some practice areas tend to have higher engagement rates
  IF conversation_record.case_category IS NOT NULL THEN
    DECLARE
      category_lower text := LOWER(conversation_record.case_category);
    BEGIN
      IF category_lower IN ('personal injury', 'workers compensation', 'medical malpractice') THEN
        quality_score := quality_score + 15;
      ELSIF category_lower IN ('family law', 'criminal defense', 'immigration') THEN
        quality_score := quality_score + 12;
      ELSIF category_lower IN ('estate planning', 'business law', 'real estate') THEN
        quality_score := quality_score + 10;
      ELSE
        quality_score := quality_score + 8;
      END IF;
    END;
  END IF;

  -- Calculate final score (0-100 scale)
  final_score := completeness_score + urgency_bonus + complexity_bonus + quality_score;

  -- Cap at 100
  IF final_score > 100 THEN
    final_score := 100;
  END IF;

  RETURN final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to assign temperature based on quality score
CREATE OR REPLACE FUNCTION assign_lead_temperature(quality_score decimal)
RETURNS text AS $$
BEGIN
  IF quality_score >= 80 THEN
    RETURN 'hot';
  ELSIF quality_score >= 60 THEN
    RETURN 'warm';
  ELSE
    RETURN 'cold';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate lead value
CREATE OR REPLACE FUNCTION estimate_lead_value(
  practice_area_name text,
  urgency_score integer,
  quality_score decimal
)
RETURNS decimal AS $$
DECLARE
  base_value decimal := 50; -- Default base value
  multiplier decimal := 1;
BEGIN
  -- Base value by practice area
  CASE LOWER(practice_area_name)
    WHEN 'personal injury' THEN base_value := 150;
    WHEN 'medical malpractice' THEN base_value := 200;
    WHEN 'workers compensation' THEN base_value := 120;
    WHEN 'criminal defense' THEN base_value := 100;
    WHEN 'family law' THEN base_value := 80;
    WHEN 'immigration' THEN base_value := 70;
    WHEN 'estate planning' THEN base_value := 60;
    WHEN 'business law' THEN base_value := 90;
    WHEN 'real estate' THEN base_value := 70;
    ELSE base_value := 50;
  END CASE;

  -- Quality multiplier
  IF quality_score >= 90 THEN
    multiplier := 1.5;
  ELSIF quality_score >= 75 THEN
    multiplier := 1.3;
  ELSIF quality_score >= 60 THEN
    multiplier := 1.1;
  ELSE
    multiplier := 0.9;
  END IF;

  -- Urgency multiplier
  IF urgency_score >= 8 THEN
    multiplier := multiplier * 1.2;
  ELSIF urgency_score >= 6 THEN
    multiplier := multiplier * 1.1;
  END IF;

  RETURN ROUND(base_value * multiplier, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate quality score when a lead is created/updated
CREATE OR REPLACE FUNCTION auto_calculate_lead_quality()
RETURNS TRIGGER AS $$
DECLARE
  conversation_id_val uuid;
  quality_score_val decimal;
  practice_area_name_val text;
  urgency_val integer;
BEGIN
  -- Get conversation ID
  conversation_id_val := NEW.conversation_id;

  -- Calculate quality score
  quality_score_val := calculate_lead_quality_score(conversation_id_val);

  -- Update lead with quality score and temperature
  NEW.quality_score := quality_score_val;
  NEW.temperature := assign_lead_temperature(quality_score_val);

  -- Get practice area name and urgency for value calculation
  SELECT pa.name, COALESCE(c.urgency_score, c.openai_urgency_score, 5)
  INTO practice_area_name_val, urgency_val
  FROM conversations c
  LEFT JOIN practice_areas pa ON pa.id = NEW.practice_area_id
  WHERE c.id = conversation_id_val;

  -- Calculate and set lead value
  IF practice_area_name_val IS NOT NULL THEN
    NEW.lead_value := estimate_lead_value(
      practice_area_name_val,
      urgency_val,
      quality_score_val
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to leads table
DROP TRIGGER IF EXISTS calculate_quality_trigger ON leads;
CREATE TRIGGER calculate_quality_trigger
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_lead_quality();

-- Backfill quality scores for existing leads
DO $$
DECLARE
  lead_record RECORD;
BEGIN
  FOR lead_record IN SELECT id, conversation_id FROM leads LOOP
    UPDATE leads
    SET
      quality_score = calculate_lead_quality_score(lead_record.conversation_id),
      temperature = assign_lead_temperature(calculate_lead_quality_score(lead_record.conversation_id))
    WHERE id = lead_record.id;
  END LOOP;
END $$;
