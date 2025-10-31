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

interface LeadExtractionData {
  caseCategory: string;
  firmLocation: string;
  openaiUrgencyScore: number;
  extractedData?: {
    name?: string;
    email?: string;
    phone?: string;
    case_description?: string;
  };
}

async function extractLeadDataFromTranscript(transcript: string): Promise<LeadExtractionData | null> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not set');
      return null;
    }

    const prompt = `
Analyze this legal conversation transcript and extract the following information:

1. Case Category (choose from: Personal Injury, Family Law, Criminal Defense, Immigration, Estate Planning, Business Law, Real Estate, Employment Law, Bankruptcy, Intellectual Property)
2. Client Location (city, state format)
3. Urgency Score (1-10, where 10 is most urgent)
4. Client Details (name, email, phone if mentioned)
5. Case Description (summary of legal issue)

Transcript:
${transcript}

Return a JSON object with this structure:
{
  "caseCategory": "string",
  "firmLocation": "string", 
  "openaiUrgencyScore": number,
  "extractedData": {
    "name": "string or null",
    "email": "string or null", 
    "phone": "string or null",
    "case_description": "string"
  }
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a legal data extraction expert. Extract information from conversation transcripts and return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('No content from OpenAI');
      return null;
    }

    try {
      const extracted = JSON.parse(content);
      console.log('Extracted lead data:', extracted);
      return extracted;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Content:', content);
      return null;
    }

  } catch (error) {
    console.error('Error extracting lead data:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    console.log('=== LEAD EXTRACTION FUNCTION CALLED ===');
    
    const { conversationId, transcript } = await req.json();
    
    if (!conversationId || !transcript) {
      return new Response(
        JSON.stringify({ error: 'Missing conversationId or transcript' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing lead extraction for conversation: ${conversationId}`);
    
    // Extract lead data using OpenAI
    const extractedData = await extractLeadDataFromTranscript(transcript);
    
    if (!extractedData) {
      console.error('Failed to extract lead data');
      return new Response(
        JSON.stringify({ error: 'Failed to extract lead data' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update conversation with extracted data
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        case_category: extractedData.caseCategory,
        firm_location: extractedData.firmLocation,
        openai_urgency_score: extractedData.openaiUrgencyScore,
        name: extractedData.extractedData?.name || null,
        email: extractedData.extractedData?.email || null,
        phone: extractedData.extractedData?.phone || null,
        case_description: extractedData.extractedData?.case_description || null,
        status: 'processed',
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update conversation' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Lead extraction and conversation update completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Lead extraction completed',
        extractedData: extractedData
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Lead extraction error:', error);
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