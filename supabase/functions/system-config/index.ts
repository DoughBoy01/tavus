import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Supabase client with service role key
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verify system admin role
    const isAdmin = await isSystemAdmin(token);
    if (!isAdmin) {
      throw new Error('Unauthorized - System admin role required');
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (req.method === 'GET' && path === 'tavus-key') {
      const { data, error } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'tavus_api_key')
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ key: data.value }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT' && path === 'tavus-key') {
      const { key } = await req.json();

      const { error } = await supabase
        .from('system_configs')
        .update({ 
          value: key,
          updated_by: user.id
        })
        .eq('key', 'tavus_api_key');

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'API key updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid endpoint');
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});