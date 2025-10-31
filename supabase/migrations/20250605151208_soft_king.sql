/*
  # Add default Tavus configuration

  1. Changes
    - Insert a default active Tavus configuration record
    
  2. Purpose
    - Ensures there is at least one active Tavus configuration for the edge function to use
    - Sets up required fields for Tavus API integration
*/

INSERT INTO tavus_configs (
  name,
  persona_id,
  custom_greeting,
  conversational_context,
  active,
  language,
  interrupt_sensitivity
) VALUES (
  'Default Configuration',
  'default-persona',
  'Hello! How can I assist you today?',
  'You are a helpful AI assistant ready to engage in conversation.',
  true,
  'en',
  'medium'
)
ON CONFLICT (name) DO NOTHING;