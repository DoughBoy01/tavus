import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /tavus-config/active - Get active configuration (PUBLIC ACCESS)
    if (req.method === 'GET' && path === 'active') {
      console.log('Getting active Tavus config (public access)');
      
      const { data, error } = await supabase
        .from('tavus_configs')
        .select('*')
        .eq('active', true)
        .single();

      if (error) {
        console.error('Error getting active config:', error);
        throw error;
      }

      console.log('Active config found:', data?.name);

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other endpoints require system admin authentication
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

    if (req.method === 'POST' && path === 'create') {
      const {
        name,
        persona_id,
        custom_greeting,
        conversational_context,
        language,
        interrupt_sensitivity,
        active
      } = await req.json();

      // If this config is being set as active, deactivate all others
      if (active) {
        await supabase
          .from('tavus_configs')
          .update({ active: false })
          .neq('id', 0); // Update all records
      }

      const { data, error } = await supabase
        .from('tavus_configs')
        .insert({
          name,
          persona_id,
          custom_greeting,
          conversational_context,
          language,
          interrupt_sensitivity,
          active,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT' && path === 'update') {
      const {
        id,
        name,
        persona_id,
        custom_greeting,
        conversational_context,
        language,
        interrupt_sensitivity,
        active
      } = await req.json();

      // If this config is being set as active, deactivate all others
      if (active) {
        await supabase
          .from('tavus_configs')
          .update({ active: false })
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('tavus_configs')
        .update({
          name,
          persona_id,
          custom_greeting,
          conversational_context,
          language,
          interrupt_sensitivity,
          active,
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE' && path === 'delete') {
      const { id } = await req.json();

      const { error } = await supabase
        .from('tavus_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Configuration deleted successfully' }),
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