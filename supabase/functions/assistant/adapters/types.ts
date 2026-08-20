// The one shape every provider adapter normalizes its response into — this is what makes the
// frontend ChatAssistant component not need to know or care which provider actually answered.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface AdapterStructuredResult {
  tool: string;
  result: any;
}

export interface AdapterResult {
  reply: string;
  structured: AdapterStructuredResult[];
}

export type Actor = { name: string; role: string };

export type RunConversation = (
  apiKey: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  client: SupabaseClient,
  actor: Actor
) => Promise<AdapterResult>;
