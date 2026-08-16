// Thin client for the PharmaTrack conversational assistant Edge Function. The frontend never
// holds an Anthropic API key or a service-role key — it only ever calls this one function,
// which holds both server-side.
import { getSupabaseClient } from './supabaseService';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantStructuredResult {
  tool: 'create_lane' | 'generate_summary_report';
  result: any;
}

export interface AssistantResponse {
  reply: string;
  structured: AssistantStructuredResult[];
}

export async function sendAssistantMessage(
  messages: AssistantMessage[],
  actor: { name: string; role: string }
): Promise<AssistantResponse> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Not connected to Supabase — the assistant needs a live cloud connection.');

  const { data, error } = await client.functions.invoke('assistant', {
    body: { messages, actor },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as AssistantResponse;
}
