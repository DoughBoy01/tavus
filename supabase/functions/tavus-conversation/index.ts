import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Supabase client with service role key
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function validateAndFixTavusUrl(url: string): string {
  console.log('Original URL from Tavus:', url);
  
  // If the URL is already in the correct format, return it
  if (url.includes('tavus.daily.co')) {
    console.log('URL is already in correct format:', url);
    return url;
  }
  
  // If it's in the old format (c.daily.co), convert it to the new format
  if (url.includes('c.daily.co')) {
    const convertedUrl = url.replace('c.daily.co', 'tavus.daily.co');
    console.log('Converted URL from c.daily.co to tavus.daily.co:', convertedUrl);
    return convertedUrl;
  }
  
  // If it's just a room ID, construct the full URL
  if (url.match(/^[a-zA-Z0-9-]+$/)) {
    const fullUrl = `https://tavus.daily.co/${url}`;
    console.log('Constructed full URL from room ID:', fullUrl);
    return fullUrl;
  }
  
  console.warn('URL format not recognized, returning as-is:', url);
  return url;
}

async function isSystemAdmin(token: string): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return false;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return false;
    return profile.role === 'system_admin';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TAVUS CONVERSATION EDGE FUNCTION CALLED ===');
    
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (req.method === 'POST' && path === 'create') {
      console.log('=== CREATING TAVUS CONVERSATION (PUBLIC ACCESS) ===');
      
      // Get active Tavus configuration (no auth required)
      const { data: config, error: configError } = await supabase
        .from('tavus_configs')
        .select('*')
        .eq('active', true)
        .single();

      if (configError) {
        console.error('Config error:', configError);
        throw new Error('No active Tavus configuration found');
      }

      console.log('Using Tavus config:', {
        name: config.name,
        persona_id: config.persona_id,
        language: config.language
      });

      // Get Tavus API key from environment variable
      const tavusApiKey = Deno.env.get('TAVUS_API_KEY');
      if (!tavusApiKey) {
        console.error('TAVUS_API_KEY environment variable not set');
        throw new Error('Tavus API key not configured');
      }

      console.log('Making request to Tavus API...');

      // Create conversation in Tavus
      const tavusPayload = {
        persona_id: config.persona_id,
        custom_greeting: config.custom_greeting,
        conversational_context: config.conversational_context,
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/tavus-webhook`
      };

      console.log('Tavus API payload:', tavusPayload);

      const response = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': tavusApiKey,
        },
        body: JSON.stringify(tavusPayload),
      });

      console.log('Tavus API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tavus API error response:', errorText);
        throw new Error(`Tavus API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const tavusData = await response.json();
      console.log('Raw Tavus API response:', JSON.stringify(tavusData, null, 2));

      // Validate and fix the conversation URL
      if (tavusData.conversation_url) {
        tavusData.conversation_url = validateAndFixTavusUrl(tavusData.conversation_url);
      } else {
        console.error('No conversation_url in Tavus response!');
        throw new Error('Tavus API did not return a conversation_url');
      }

      console.log('Final conversation data to return:', {
        conversation_id: tavusData.conversation_id,
        conversation_url: tavusData.conversation_url,
        status: tavusData.status
      });

      // Store conversation in database (no user_id, public access)
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          tavus_conversation_id: tavusData.conversation_id,
          user_id: null, // No user authentication required
          status: 'new'
        })
        .select()
        .single();

      if (conversationError) {
        console.error('Database error:', conversationError);
        throw conversationError;
      }

      console.log('Conversation stored in database:', conversation.id);

      return new Response(
        JSON.stringify(tavusData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === 'end') {
      const { conversation_id, conversationData } = await req.json();

      console.log('=== ENDING TAVUS CONVERSATION (PUBLIC ACCESS) ===');
      console.log('Conversation ID:', conversation_id);

      // Get Tavus API key from environment variable
      const tavusApiKey = Deno.env.get('TAVUS_API_KEY');
      if (!tavusApiKey) {
        throw new Error('Tavus API key not configured');
      }

      // End conversation in Tavus
      const response = await fetch(
        `https://tavusapi.com/v2/conversations/${conversation_id}/end`,
        {
          method: 'POST',
          headers: {
            'x-api-key': tavusApiKey,
          },
        }
      );

      console.log('End conversation response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tavus end conversation error:', errorText);
        throw new Error(`Tavus API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Update conversation with collected data and set status to processed
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          status: 'processed',
          name: conversationData?.name || null,
          email: conversationData?.email || null,
          phone: conversationData?.phone || null,
          case_description: conversationData?.case_description || null,
          urgency_score: conversationData?.urgency_score || 5
        })
        .eq('tavus_conversation_id', conversation_id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Conversation ended and updated successfully');

      return new Response(
        JSON.stringify({ message: 'Conversation ended successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For admin endpoints, check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header for admin endpoint');
    }

    const token = authHeader.replace('Bearer ', '');
    const isAdmin = await isSystemAdmin(token);
    if (!isAdmin) {
      throw new Error('Unauthorized - System admin role required');
    }

    throw new Error('Invalid endpoint');
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});