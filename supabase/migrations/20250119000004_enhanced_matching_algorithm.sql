/*
  # Enhanced Matching Algorithm

  This migration replaces the basic matching function with an advanced algorithm that considers:
  - Practice area alignment (40%)
  - Firm performance metrics (25%)
  - Availability/capacity (15%)
  - Geographic proximity (10%)
  - Lead quality fit (10%)
*/

-- Enhanced function to match leads to law firms
CREATE OR REPLACE FUNCTION match_lead_to_firms(lead_id uuid)
RETURNS void AS $$
DECLARE
  v_practice_area_id uuid;
  v_conversation_id uuid;
  v_location text;
  v_urgency integer;
  v_quality_score decimal;
  v_lead_value decimal;
  firm_record RECORD;
BEGIN
  -- Get lead and conversation data
  SELECT
    l.practice_area_id,
    l.conversation_id,
    l.quality_score,
    l.lead_value,
    c.firm_location,
    COALESCE(c.urgency_score, c.openai_urgency_score, 5) as urgency
  INTO
    v_practice_area_id,
    v_conversation_id,
    v_quality_score,
    v_lead_value,
    v_location,
    v_urgency
  FROM
    leads l
    JOIN conversations c ON c.id = l.conversation_id
  WHERE
    l.id = lead_id;

  -- Delete any existing matches for this lead to refresh them
  DELETE FROM matches WHERE lead_id = lead_id;

  -- Find matching law firms and calculate advanced scores
  FOR firm_record IN
    SELECT
      lf.id AS law_firm_id,
      lf.name,
      lf.capacity,
      lf.success_rate,
      lf.location,
      lf.rating,
      lf.subscription_status,
      lf.monthly_lead_limit,
      lf.leads_used_this_month,
      lf.avg_response_time_minutes,
      lf.total_leads_converted,
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
    WHERE
      lf.subscription_status = 'active'
      OR (lf.subscription_tier = 'free' AND lf.leads_used_this_month < 3)
  LOOP
    -- Only match firms that have the required practice area
    IF firm_record.has_practice_area THEN
      DECLARE
        -- Score components (0.0 to 1.0 scale for each)
        practice_area_score decimal := 0.0;
        performance_score decimal := 0.0;
        availability_score decimal := 0.0;
        location_score decimal := 0.5; -- Default neutral score
        quality_fit_score decimal := 0.0;

        -- Weights
        practice_area_weight decimal := 0.40; -- 40%
        performance_weight decimal := 0.25;    -- 25%
        availability_weight decimal := 0.15;   -- 15%
        location_weight decimal := 0.10;       -- 10%
        quality_fit_weight decimal := 0.10;    -- 10%

        total_score decimal;
      BEGIN
        -- 1. PRACTICE AREA SCORE (0.0 - 1.0)
        -- Base score for having the practice area
        practice_area_score := 0.6;

        -- Bonus for experience
        IF firm_record.experience_years >= 10 THEN
          practice_area_score := practice_area_score + 0.4;
        ELSIF firm_record.experience_years >= 5 THEN
          practice_area_score := practice_area_score + 0.3;
        ELSIF firm_record.experience_years >= 2 THEN
          practice_area_score := practice_area_score + 0.2;
        ELSE
          practice_area_score := practice_area_score + 0.1;
        END IF;

        -- 2. PERFORMANCE SCORE (0.0 - 1.0)
        -- Based on firm rating, success rate, and conversion history
        DECLARE
          rating_component decimal := COALESCE(firm_record.rating / 5.0, 0.5);
          success_component decimal := COALESCE(firm_record.success_rate, 0.5);
          conversion_component decimal;
        BEGIN
          -- Calculate conversion component based on historical performance
          IF firm_record.total_leads_converted >= 50 THEN
            conversion_component := 1.0;
          ELSIF firm_record.total_leads_converted >= 20 THEN
            conversion_component := 0.8;
          ELSIF firm_record.total_leads_converted >= 10 THEN
            conversion_component := 0.6;
          ELSIF firm_record.total_leads_converted >= 5 THEN
            conversion_component := 0.4;
          ELSE
            conversion_component := 0.3; -- New firms get base score
          END IF;

          -- Weighted average of performance components
          performance_score := (rating_component * 0.4) +
                             (success_component * 0.4) +
                             (conversion_component * 0.2);
        END;

        -- 3. AVAILABILITY SCORE (0.0 - 1.0)
        -- Based on current capacity vs usage
        DECLARE
          usage_ratio decimal;
          response_time_score decimal;
        BEGIN
          -- Calculate usage ratio
          IF firm_record.monthly_lead_limit > 0 THEN
            usage_ratio := firm_record.leads_used_this_month::decimal / firm_record.monthly_lead_limit::decimal;

            IF usage_ratio < 0.5 THEN
              availability_score := 1.0; -- Plenty of capacity
            ELSIF usage_ratio < 0.75 THEN
              availability_score := 0.7;
            ELSIF usage_ratio < 0.9 THEN
              availability_score := 0.4;
            ELSE
              availability_score := 0.2; -- Nearly full
            END IF;
          ELSE
            availability_score := 0.1; -- No capacity data
          END IF;

          -- Factor in average response time
          IF firm_record.avg_response_time_minutes IS NOT NULL THEN
            IF firm_record.avg_response_time_minutes < 120 THEN -- < 2 hours
              response_time_score := 1.0;
            ELSIF firm_record.avg_response_time_minutes < 240 THEN -- < 4 hours
              response_time_score := 0.8;
            ELSIF firm_record.avg_response_time_minutes < 480 THEN -- < 8 hours
              response_time_score := 0.6;
            ELSE
              response_time_score := 0.4;
            END IF;

            -- Blend response time with capacity
            availability_score := (availability_score * 0.7) + (response_time_score * 0.3);
          END IF;
        END;

        -- 4. LOCATION SCORE (0.0 - 1.0)
        -- Basic proximity based on matching location strings
        IF v_location IS NOT NULL AND firm_record.location IS NOT NULL THEN
          DECLARE
            location_lower text := LOWER(v_location);
            firm_location_lower text := LOWER(firm_record.location);
          BEGIN
            -- Exact match
            IF firm_location_lower = location_lower THEN
              location_score := 1.0;
            -- Partial match (state/city in description)
            ELSIF location_lower LIKE '%' || firm_location_lower || '%' OR
                  firm_location_lower LIKE '%' || location_lower || '%' THEN
              location_score := 0.7;
            -- No match but both have location data
            ELSE
              location_score := 0.3;
            END IF;
          END;
        END IF;

        -- 5. QUALITY FIT SCORE (0.0 - 1.0)
        -- Match lead quality/value with firm tier
        IF v_quality_score IS NOT NULL THEN
          DECLARE
            is_premium_firm boolean := firm_record.subscription_tier IN ('pro', 'enterprise');
            is_high_quality_lead boolean := v_quality_score >= 75;
          BEGIN
            -- Premium firms get bonus for high-quality leads
            IF is_premium_firm AND is_high_quality_lead THEN
              quality_fit_score := 1.0;
            ELSIF is_premium_firm THEN
              quality_fit_score := 0.7; -- Premium firms can handle all leads
            ELSIF is_high_quality_lead THEN
              quality_fit_score := 0.8; -- High-quality leads good for all firms
            ELSE
              quality_fit_score := 0.6; -- Standard fit
            END IF;

            -- Urgency factor
            IF v_urgency >= 8 AND firm_record.avg_response_time_minutes IS NOT NULL AND
               firm_record.avg_response_time_minutes < 180 THEN
              quality_fit_score := quality_fit_score * 1.1; -- Bonus for fast-responding firms on urgent cases
            END IF;

            -- Cap at 1.0
            IF quality_fit_score > 1.0 THEN
              quality_fit_score := 1.0;
            END IF;
          END;
        ELSE
          quality_fit_score := 0.5; -- Neutral if no quality data
        END IF;

        -- CALCULATE TOTAL WEIGHTED SCORE
        total_score := (practice_area_score * practice_area_weight) +
                       (performance_score * performance_weight) +
                       (availability_score * availability_weight) +
                       (location_score * location_weight) +
                       (quality_fit_score * quality_fit_weight);

        -- Only create matches above a minimum threshold (0.3 = 30%)
        IF total_score >= 0.3 THEN
          -- Create match record
          INSERT INTO matches (
            lead_id,
            law_firm_id,
            match_score,
            status,
            metadata
          ) VALUES (
            lead_id,
            firm_record.law_firm_id,
            total_score,
            'pending',
            jsonb_build_object(
              'practice_area_score', practice_area_score,
              'performance_score', performance_score,
              'availability_score', availability_score,
              'location_score', location_score,
              'quality_fit_score', quality_fit_score,
              'experience_years', firm_record.experience_years,
              'firm_rating', firm_record.rating,
              'avg_response_time', firm_record.avg_response_time_minutes
            )
          );
        END IF;
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
  ELSE
    -- No matches found
    UPDATE leads SET status = 'unmatched' WHERE id = lead_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add metadata column to matches table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE matches ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Refresh existing matches with new algorithm
DO $$
DECLARE
  lead_record RECORD;
BEGIN
  FOR lead_record IN SELECT id FROM leads WHERE status IN ('matched', 'pending') LOOP
    PERFORM match_lead_to_firms(lead_record.id);
  END LOOP;
END $$;
