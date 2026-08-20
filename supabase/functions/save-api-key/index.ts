// Connects (or replaces) an authenticated user's own API key for a supported Advanced
// assistant provider. This is the ONLY path in the app that ever sees a user's raw key —
// it's never written to any client-visible table column, and it's never sent back to the
// browser after this call returns. It's held only long enough to hand to
// public.save_user_api_key(), which stores it in Supabase Vault via vault.create_secret /
// vault.update_secret and locks that RPC to service_role only.
//
// Deploy: supabase functions deploy save-api-key
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.)
//
// Requires user_api_keys_schema.sql (already applied) plus the save_user_api_key() function
// and user_profiles.active_ai_provider column (migration: add_active_ai_provider_and_save_user_api_key).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPPORTED_PROVIDERS = ['Anthropic', 'OpenAI', 'Google Gemini'] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase environment variables were not injected — this should never happen for a deployed function.' }, 500);
  }

  // A real signed-in Supabase session is required — this is never reachable by an
  // unauthenticated demo visitor, and there is no client-supplied user id to spoof: the id
  // used below always comes from verifying this request's own bearer token.
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearerToken) return json({ error: 'You must be signed in to connect an API key.' }, 401);

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await client.auth.getUser(bearerToken);
  if (userError || !userData?.user) return json({ error: 'You must be signed in to connect an API key.' }, 401);
  const userId = userData.user.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON: { provider, secret, label? }' }, 400);
  }

  const { provider, secret, label } = payload || {};
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return json({ error: `provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}` }, 400);
  }
  if (typeof secret !== 'string' || secret.trim().length < 8) {
    return json({ error: 'That key looks too short to be valid.' }, 400);
  }

  const { data: secretId, error: saveError } = await client.rpc('save_user_api_key', {
    p_user_id: userId,
    p_provider: provider as Provider,
    p_secret: secret,
    p_label: typeof label === 'string' && label.trim() ? label.trim() : null,
  });

  if (saveError) {
    console.error('save_user_api_key error:', saveError);
    return json({ error: `Couldn't save that key: ${saveError.message}` }, 500);
  }

  // If this is the user's only connected provider (or their first), make it the active one —
  // otherwise leave whatever they already had selected alone (they can switch it explicitly).
  const { data: existingKeys } = await client.from('user_api_keys').select('provider').eq('user_id', userId);
  if ((existingKeys || []).length === 1) {
    await client.from('user_profiles').update({ active_ai_provider: provider }).eq('id', userId);
  }

  return json({ saved: true, provider, secretId });
});
