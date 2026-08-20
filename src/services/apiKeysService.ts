// Client for the "connect your own AI provider key" flow. Reads are direct (RLS-safe — the
// user_api_keys table never stores a raw key column, only the Vault secret id, a label, and the
// last four characters), but every write goes through the save-api-key Edge Function, which is
// the only thing that ever sees the raw key value and the only thing allowed to call
// save_user_api_key() (locked to service_role — see that function's migration comment).
import { getSupabaseClient } from './supabaseService';

export const SUPPORTED_AI_PROVIDERS = ['Anthropic', 'OpenAI', 'Google Gemini'] as const;
export type AiProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

export interface ConnectedApiKey {
  provider: AiProvider;
  label: string | null;
  lastFourChars: string;
  createdAt: string;
  isActive: boolean;
}

function mapRow(row: any): ConnectedApiKey {
  return {
    provider: row.provider,
    label: row.key_label ?? null,
    lastFourChars: String(row.last_four_chars || '????'),
    createdAt: String(row.created_at),
    isActive: Boolean(row.is_active),
  };
}

/** Every connected key for the current user, masked — provider, label, last four characters,
 *  created date. The raw key itself was never stored here in the first place, so there is
 *  nothing to redact; this really is everything the table has. */
export async function listConnectedApiKeys(): Promise<ConnectedApiKey[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('user_api_keys')
    .select('provider, key_label, last_four_chars, created_at, is_active')
    .order('created_at', { ascending: true });
  if (error || !data) {
    console.warn('user_api_keys fetch notice:', error?.message);
    return [];
  }
  return data.map(mapRow);
}

/** Which connected provider the Advanced assistant should use for this user right now. Null
 *  means "no explicit choice yet" — the caller (Settings UI, or the assistant Edge Function)
 *  falls back to the only connected provider if there's exactly one, or prompts a choice if
 *  there's more than one and none is set. */
export async function fetchActiveAiProvider(userId: string): Promise<AiProvider | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('user_profiles').select('active_ai_provider').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data.active_ai_provider as AiProvider) ?? null;
}

/** Direct client write — RLS-permitted (a user may always update their own profile row apart
 *  from `role`), and this is just a preference pointer, never a secret. */
export async function setActiveAiProvider(userId: string, provider: AiProvider): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };
  const { error } = await client.from('user_profiles').update({ active_ai_provider: provider }).eq('id', userId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

/** Connects (or replaces) the current user's key for one provider. Routed entirely through the
 *  save-api-key Edge Function — never a direct client insert — so the raw key value only ever
 *  exists in this request body and inside that function's memory before it reaches Vault. */
export async function saveApiKey(
  provider: AiProvider,
  secret: string,
  label?: string
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Not connected to Supabase.' };

  const { data, error } = await client.functions.invoke('save-api-key', {
    body: { provider, secret, label: label?.trim() || undefined },
  });

  if (error) return { success: false, message: error.message };
  if (data?.error) return { success: false, message: data.error };
  return { success: true };
}
