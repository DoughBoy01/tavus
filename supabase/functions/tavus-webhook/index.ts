import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tavus-signature',
};

// Initialize Supabase client with service role key
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function extractConversationId(data: any): string | null {
  // Try multiple possible locations for conversation_id
  const possiblePaths = [
    data.conversation_id,
    data.conversationId,
    data.id,
    data.data?.conversation_id,
    data.data?.conversationId,
    data.data?.id,
    data.conversation?.conversation_id,
    data.conversation?.conversationId,
    data.conversation?.id,
    data.payload?.conversation_id,
    data.payload?.conversationId,
    data.payload?.id,
    data.object?.conversation_id,
    data.object?.conversationId,
    data.object?.id,
  ];

  for (const path of possiblePaths) {
    if (path && typeof path === 'string') {
      console.log(`Found conversation_id: ${path}`);
      return path;
    }
  }

  return null;
}

async function fetchTranscriptFromTavus(conversationId: string): Promise<string | null> {
  try {
    const tavusApiKey = Deno.env.get('TAVUS_API_KEY');
    if (!tavusApiKey) {
      console.error('TAVUS_API_KEY environment variable not set');
      return null;
    }

    console.log(`Fetching transcript for conversation: ${conversationId}`);
    
    const response = await fetch(
      `https://tavusapi.com/v2/conversations/${conversationId}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': tavusApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Tavus API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('Tavus API response received:', JSON.stringify(data, null, 2));
    
    // Extract transcript from the response - check multiple possible locations
    let transcript = null;
    
    if (data.transcript) {
      transcript = data.transcript;
    } else if (data.conversation && data.conversation.transcript) {
      transcript = data.conversation.transcript;
    } else if (data.data && data.data.transcript) {
      transcript = data.data.transcript;
    }
    
    if (!transcript) {
      console.warn('No transcript found in Tavus response');
      console.log('Available fields:', Object.keys(data));
      return null;
    }

    console.log('Transcript found:', transcript);
    return transcript;
  } catch (error) {
    console.error('Error fetching transcript from Tavus:', error);
    return null;
  }
}

async function updateConversationTranscript(conversationId: string, transcript: string): Promise<boolean> {
  try {
    console.log(`Updating transcript for conversation: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        transcript: transcript,
        transcript_received_at: new Date().toISOString()
      })
      .eq('tavus_conversation_id', conversationId)
      .select('id');

    if (error) {
      console.error('Supabase update error:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn(`No conversation found with tavus_conversation_id: ${conversationId}`);
      return false;
    }

    console.log(`Successfully updated transcript for conversation: ${conversationId}`);
    
    // Trigger lead extraction process
    await triggerLeadExtraction(data[0].id, transcript);
    
    return true;
  } catch (error) {
    console.error('Error updating conversation transcript:', error);
    return false;
  }
}

async function triggerLeadExtraction(conversationId: string, transcript: string): Promise<void> {
  try {
    console.log(`Triggering lead extraction for conversation: ${conversationId}`);
    
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-lead-extraction`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          conversationId,
          transcript,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lead extraction function error:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Lead extraction completed:', result);
    
  } catch (error) {
    console.error('Error triggering lead extraction:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Get the raw request body
    const rawBody = await req.text();
    let webhookData;
    
    try {
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Invalid JSON in webhook payload:', parseError);
      console.error('Raw body:', rawBody);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Full webhook payload:', JSON.stringify(webhookData, null, 2));
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    // Extract conversation_id from webhook payload using improved extraction
    const conversationId = extractConversationId(webhookData);
    
    if (!conversationId) {
      console.error('=== NO CONVERSATION_ID FOUND ===');
      console.error('Webhook payload structure:');
      console.error('Top-level keys:', Object.keys(webhookData));
      
      // Log nested structure
      for (const [key, value] of Object.entries(webhookData)) {
        if (typeof value === 'object' && value !== null) {
          console.error(`${key} keys:`, Object.keys(value));
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Missing conversation_id in payload',
          received_keys: Object.keys(webhookData),
          payload: webhookData
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check event type
    const eventType = webhookData.event_type || webhookData.type || webhookData.event || 'unknown';
    console.log(`Processing webhook event: ${eventType} for conversation: ${conversationId}`);

    // Handle different event types - now including application.transcription_ready
    if (eventType === 'conversation.ended' || 
        eventType === 'conversation_ended' || 
        eventType === 'ended' ||
        eventType === 'conversation.completed' ||
        eventType === 'completed' ||
        eventType === 'application.transcription_ready' ||
        eventType === 'transcription_ready') {
      
      console.log('Conversation ended or transcription ready event received, fetching transcript...');
      
      // Wait a moment for Tavus to process the transcript (especially for end events)
      if (eventType !== 'application.transcription_ready' && eventType !== 'transcription_ready') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Fetch the full conversation details from Tavus
      const transcript = await fetchTranscriptFromTavus(conversationId);
      
      if (!transcript) {
        console.error('Failed to fetch transcript from Tavus');
        // Still return success to avoid webhook retries
        return new Response(
          JSON.stringify({ 
            message: 'Webhook received but no transcript available yet',
            conversation_id: conversationId,
            event_type: eventType
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Update the conversation in Supabase and trigger lead extraction
      const updateSuccess = await updateConversationTranscript(conversationId, transcript);
      
      if (!updateSuccess) {
        return new Response(
          JSON.stringify({ error: 'Failed to update conversation in database' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          message: 'Transcript stored and lead extraction triggered',
          conversation_id: conversationId,
          event_type: eventType
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // For other event types, just acknowledge receipt
      console.log(`Received ${eventType} event for conversation ${conversationId}`);
      return new Response(
        JSON.stringify({ 
          message: 'Webhook received',
          event_type: eventType,
          conversation_id: conversationId
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});