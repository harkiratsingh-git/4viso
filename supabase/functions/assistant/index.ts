// PharmaTrack Advanced assistant — the endpoint the frontend chat panel calls once a user is
// signed in. Provider-agnostic by design: it never holds its own Anthropic/OpenAI/Gemini key
// for this tier. Instead, at request time it looks up the authenticated caller's own connected
// key (via get_user_api_key(), which decrypts from Supabase Vault — see
// user_api_keys_schema.sql and the save_user_api_key migration) and hands the conversation to
// that provider's adapter in ./adapters/. If the user hasn't connected a key, this returns a
// clear "connect one in Settings" response — it never silently falls back to an app-managed key,
// since that would defeat the entire point of BYOK (cost isolation).
//
// The unauthenticated demo tier is a completely separate function (../assistant-demo,
// Gemini-backed, app-managed, capped) — this function no longer accepts unauthenticated
// requests at all, since that tier now has its own dedicated home.
//
// Deploy: supabase functions deploy assistant
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runConversation as runAnthropic } from './adapters/anthropic.ts';
import { runConversation as runOpenAi } from './adapters/openai.ts';
import { runConversation as runGemini } from './adapters/gemini.ts';
import type { RunConversation } from './adapters/types.ts';

const SUPPORTED_PROVIDERS = ['Anthropic', 'OpenAI', 'Google Gemini'] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

const ADAPTERS: Record<Provider, RunConversation> = {
  Anthropic: runAnthropic,
  OpenAI: runOpenAi,
  'Google Gemini': runGemini,
};

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

  // Authenticated status is decided server-side from the request's own bearer token, never from
  // anything the client claims. This tier requires a real signed-in user — the demo tier lives
  // in ../assistant-demo now, so there is no anonymous path through this function at all.
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearerToken) return json({ error: 'Sign in to use the Advanced assistant.' }, 401);

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await client.auth.getUser(bearerToken);
  if (userError || !userData?.user) return json({ error: 'Sign in to use the Advanced assistant.' }, 401);
  const userId = userData.user.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON: { messages: [...], actor: { name, role } }' }, 400);
  }

  const { messages, actor } = payload || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages must be a non-empty array of { role, content } turns.' }, 400);
  }
  const resolvedActor = { name: actor?.name || 'PharmaTrack User', role: actor?.role || 'Quality Lead' };

  // Resolve which provider this request should use — never falls back to any app-managed key.
  const { data: connectedRows } = await client.from('user_api_keys').select('provider').eq('user_id', userId);
  const connectedProviders = (connectedRows || []).map((r: any) => r.provider as Provider);

  if (connectedProviders.length === 0) {
    return json(
      {
        error: 'Connect an API key in Settings to use the Advanced assistant — it never falls back to a shared app key.',
        noApiKeyConnected: true,
      },
      200
    );
  }

  const { data: profileRow } = await client.from('user_profiles').select('active_ai_provider').eq('id', userId).maybeSingle();
  let targetProvider = profileRow?.active_ai_provider as Provider | null;
  if (!targetProvider || !connectedProviders.includes(targetProvider)) {
    if (connectedProviders.length === 1) {
      targetProvider = connectedProviders[0];
    } else {
      return json(
        {
          error: `You've connected ${connectedProviders.join(' and ')} — pick which one the Advanced assistant should use in Settings.`,
          noActiveProviderChosen: true,
          connectedProviders,
        },
        200
      );
    }
  }

  const { data: apiKey, error: keyError } = await client.rpc('get_user_api_key', {
    p_user_id: userId,
    p_provider: targetProvider,
  });
  if (keyError || !apiKey) {
    return json({ error: `Couldn't retrieve your ${targetProvider} key — try reconnecting it in Settings.` }, 500);
  }

  try {
    const result = await ADAPTERS[targetProvider](apiKey, messages, client, resolvedActor);
    return json({ reply: result.reply, structured: result.structured, provider: targetProvider });
  } catch (err) {
    console.error('assistant error:', err);
    return json({ error: `Assistant request failed: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
