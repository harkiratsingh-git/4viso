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
  /** Which connected provider actually answered (Anthropic, OpenAI, or Google Gemini) — purely
   *  informational; the frontend never needs to branch on this to render the reply. */
  provider?: string;
}

/** Thrown when the Advanced assistant can't proceed because the signed-in user hasn't connected
 *  an AI provider key (or has connected more than one and hasn't picked which is active) — it
 *  never silently falls back to an app-managed key, so this is a real dead end the UI has to
 *  send the user to Settings to resolve, not just a retryable error. */
export class NoApiKeyConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoApiKeyConnectedError';
  }
}

/** The Gemini-backed demo assistant's structured results never include create_lane — lane
 *  creation is excluded from the unauthenticated tier (see supabase/functions/assistant-demo). */
export interface DemoStructuredResult {
  tool: 'generate_summary_report';
  result: any;
}

export interface DemoAssistantResponse {
  reply: string;
  structured: DemoStructuredResult[];
  /** How many of today's per-session demo requests are left, so the UI can show a running
   *  usage indicator (e.g. "12 of 25 requests used today") instead of the limit only ever
   *  appearing as a surprise on the request that finally hits it. */
  sessionRequestsRemaining: number;
  sessionRequestsCap: number;
}

/** Thrown when either the demo assistant's server-side cap has been hit — the per-session cap
 *  (`kind: 'session'`, this browser's own daily allowance) or, for the Gemini-backed demo tier
 *  only, the shared global cap (`kind: 'global'`, today's budget across every demo visitor).
 *  The message text itself already differs between the two so the chat UI can show it verbatim;
 *  `kind` is there for any UI that wants to react to the two cases differently. The Claude-backed
 *  authenticated-tier cap (supabase/functions/assistant) only has one kind of limit, so it always
 *  reports 'session'. */
export class DemoLimitReachedError extends Error {
  kind: 'session' | 'global';
  constructor(message: string, kind: 'session' | 'global' = 'session') {
    super(message);
    this.name = 'DemoLimitReachedError';
    this.kind = kind;
  }
}

const DEMO_SESSION_STORAGE_KEY = 'pharmatrack_demo_session_id';

/** A stable anonymous id for this browser's demo usage, generated once and reused for every
 *  assistant call made before sign-in — this is what the Edge Function keys the server-side
 *  token cap on (demo_sessions.session_id), never anything derived from a real account. Not
 *  used at all once the caller is authenticated (see sendAssistantMessage below). */
export function getOrCreateDemoSessionId(): string {
  try {
    const existing = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to a per-call id, which
    // just means the cap is enforced per-request instead of across a demo session.
    return crypto.randomUUID();
  }
}

/** Calls the provider-agnostic `assistant` Edge Function — the Advanced tier, reachable only by
 *  a signed-in user. It looks up the caller's own connected API key server-side (never accepts
 *  one from the client) and never falls back to an app-managed key; see that function's header
 *  comment. There's no sessionId here at all — that concept belongs to the demo tier
 *  (sendDemoAssistantMessage below), which this function no longer overlaps with. */
export async function sendAssistantMessage(
  messages: AssistantMessage[],
  actor: { name: string; role: string }
): Promise<AssistantResponse> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Not connected to Supabase — the assistant needs a live cloud connection.');

  const { data, error } = await client.functions.invoke('assistant', { body: { messages, actor } });

  if (error) throw error;
  if (data?.error) {
    if (data.noApiKeyConnected || data.noActiveProviderChosen) throw new NoApiKeyConnectedError(data.error);
    throw new Error(data.error);
  }
  return data as AssistantResponse;
}

/** Calls the Gemini-backed `assistant-demo` Edge Function — a completely separate function from
 *  `assistant` (see that file's header comment for why), used for every unauthenticated visitor
 *  and for any authenticated session viewing non-cloud data (ChatAssistant decides which to
 *  call). Always sends the same anonymous session id `sendAssistantMessage` uses for the Claude
 *  demo cap — the two are unrelated caps in unrelated tables, but reusing one stable per-browser
 *  id for both keeps a single "this browser's demo identity" concept instead of two. */
export async function sendDemoAssistantMessage(
  messages: AssistantMessage[],
  actor: { name: string; role: string }
): Promise<DemoAssistantResponse> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Not connected to Supabase — the assistant needs a live cloud connection.');

  const { data, error } = await client.functions.invoke('assistant-demo', {
    body: { messages, actor, sessionId: getOrCreateDemoSessionId() },
  });

  if (error) throw error;
  if (data?.error) {
    if (data.sessionLimitReached) throw new DemoLimitReachedError(data.error, 'session');
    if (data.globalLimitReached) throw new DemoLimitReachedError(data.error, 'global');
    throw new Error(data.error);
  }
  return data as DemoAssistantResponse;
}
