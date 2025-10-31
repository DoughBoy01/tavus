/*
  # Add transcript column to conversations table

  1. Changes
    - Add `transcript` column to conversations table to store Tavus transcripts
    - Add `transcript_received_at` timestamp to track when transcript was received
    
  2. Purpose
    - Store conversation transcripts from Tavus webhook
    - Track when transcripts are received for auditing
*/

-- Add transcript column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS transcript_received_at timestamptz;

-- Add index on tavus_conversation_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_conversations_tavus_id 
ON conversations(tavus_conversation_id);