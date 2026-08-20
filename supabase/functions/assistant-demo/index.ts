// PharmaTrack DEMO conversational assistant — Gemini-backed, unauthenticated-only. This is a
// deliberately SEPARATE Edge Function from ../assistant (Claude-backed, for signed-in users),
// not a branch of one function across two incompatible tool-calling formats: Claude's Messages
// API and Gemini's generateContent API use different request/response shapes for tool use
// (input_schema vs. parameters, tool_use/tool_result blocks vs. functionCall/functionResponse
// parts), so they get their own orchestration loops. Only the underlying data-access logic
// (tools.ts's tool implementations, recommendation.ts, report.ts) is shared in concept with the
// Claude assistant — never the LLM-facing schema.
//
// Holds the Gemini API key (never exposed to the browser) and the Supabase service-role key
// (also never exposed). lane creation is NOT offered here — see tools.ts.
//
// Deploy: supabase functions deploy assistant-demo
// Secrets: supabase secrets set GEMINI_API_KEY=...
// Optional: supabase secrets set GEMINI_MODEL=... GEMINI_SESSION_DAILY_CAP=... GEMINI_GLOBAL_DAILY_CAP=...
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.)
//
// Requires gemini_session_usage (session_id uuid + usage_date date composite PK, requests_used
// int default 0, first_request_at, last_request_at) and gemini_daily_budget (usage_date date PK,
// requests_used int default 0) — already present in this project's schema
// (gemini_demo_usage_schema.sql), RLS locked to service-role only.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GEMINI_TOOL_DECLARATIONS, executeTool } from './tools.ts';

// gemini-3.5-flash-lite is the free-tier-friendly model this demo tier is built around — Gemini
// 2.5 Flash-Lite was retired for new callers (confirmed live against the real API: a request to
// gemini-2.5-flash-lite returns a 404 telling new callers to use gemini-3.5-flash-lite instead,
// not something guessed from documentation). Override via secret if the key's actual AI Studio
// project has a different model provisioned.
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const MAX_TOOL_ROUNDS = 6;

// Per-session daily cap — how many questions one anonymous visitor can ask today. 25 is a
// reasonable, deliberately modest default for a single visitor's demo allowance; tune via
// secret if real usage shows it's too tight or too loose.
const SESSION_DAILY_CAP = Number(Deno.env.get('GEMINI_SESSION_DAILY_CAP')) || 25;

// Global daily cap — protects the actual Gemini free-tier requests-per-day quota shared across
// EVERY anonymous demo visitor. THIS IS A PLACEHOLDER, not a researched number: as of this
// deploy, nobody has confirmed the live RPD/RPM/TPM figures shown on the actual Google AI
// Studio project dashboard for the key in use (these have changed more than once through 2026,
// so a number from documentation or a blog post can't be trusted either). 200 was picked only
// to be conservatively low — safely under any plausible free-tier RPD for a Flash-Lite-class
// model with headroom for the rest of the day. Replace this via
// `supabase secrets set GEMINI_GLOBAL_DAILY_CAP=<real RPD, minus a safety margin>` once the
// dashboard numbers are confirmed, rather than trusting this default in production.
const GLOBAL_DAILY_CAP = Number(Deno.env.get('GEMINI_GLOBAL_DAILY_CAP')) || 200;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT = `You are the PharmaTrack demo assistant — a limited, unauthenticated preview of the full PharmaTrack conversational assistant, embedded in a pharmaceutical cold-chain logistics dashboard used by Quality Leads, GDP Auditors, and Logistics Directors.

Rules:
- ALWAYS call get_dashboard_summary or get_lane_status before answering any factual question about current fleet or lane state (counts, GDP compliance, temperatures, risk, delays). Never answer from general knowledge about what a "typical" value might be — this is a regulated GDP environment and stale or invented numbers are a real compliance problem.
- recommend_route and recommend_carrier are advisory only. Present the recommendation and its reasoning clearly, but never imply the user must follow it.
- Every corridor advisory has an as_of date. If a tool result includes is_stale: true, you MUST pass its staleness_warning along to the user verbatim before or alongside the advisory content — never present a stale advisory as settled fact.
- generate_summary_report takes a few seconds; let the user know it's running, then share the download link it returns.
- This demo tier cannot create or modify lanes. If asked to create, edit, or provision a lane, explain that lane creation requires signing in to the full assistant, and offer recommend_route/recommend_carrier instead if that helps them decide what they'd create.
- Keep replies concise and concrete — lane codes, numbers, and named reasons, not vague reassurance.`;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

async function callGemini(apiKey: string, contents: GeminiContent[]): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS }],
      }),
    }
  );
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${bodyText.slice(0, 500)}`);
  }
  return JSON.parse(bodyText);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not configured on this Edge Function. Run: supabase secrets set GEMINI_API_KEY=...' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment variables were not injected — this should never happen for a deployed function.' }, 500);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON: { messages: [...], actor: { name, role }, sessionId }' }, 400);
  }

  const { messages, sessionId } = payload || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages must be a non-empty array of { role, content } turns.' }, 400);
  }
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return json({ error: 'sessionId (a UUID) is required for the demo assistant.' }, 400);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const today = todayUtc();

  // Session cap first — if this browser's demo session already used up its daily allowance,
  // say so without touching Gemini or the shared global counter at all.
  const { data: sessionRowRaw } = await client
    .from('gemini_session_usage')
    .select('requests_used')
    .eq('session_id', sessionId)
    .eq('usage_date', today)
    .maybeSingle();
  const sessionRequestsUsed = sessionRowRaw?.requests_used ?? 0;

  if (sessionRequestsUsed >= SESSION_DAILY_CAP) {
    return json(
      {
        error: "You've used today's demo question limit for this session — it resets tomorrow, or sign in for unlimited access to the full assistant.",
        sessionLimitReached: true,
        sessionRequestsRemaining: 0,
        sessionRequestsCap: SESSION_DAILY_CAP,
      },
      200
    );
  }

  // Global cap second — protects the real shared Gemini quota across every demo visitor today.
  // Different wording on purpose: this isn't "your" limit, it's everyone's.
  const { data: globalRowRaw } = await client
    .from('gemini_daily_budget')
    .select('requests_used')
    .eq('usage_date', today)
    .maybeSingle();
  const globalRequestsUsed = globalRowRaw?.requests_used ?? 0;

  if (globalRequestsUsed >= GLOBAL_DAILY_CAP) {
    return json(
      {
        error: 'The demo assistant has reached its shared usage limit for today across all visitors — please try again tomorrow, or sign in for the full assistant.',
        globalLimitReached: true,
        sessionRequestsRemaining: Math.max(0, SESSION_DAILY_CAP - sessionRequestsUsed),
        sessionRequestsCap: SESSION_DAILY_CAP,
      },
      200
    );
  }

  const contents: GeminiContent[] = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '') }],
  }));

  const structured: { tool: string; result: any }[] = [];
  let finalText = '';
  // Counts actual Gemini API calls made while answering this one user turn (a single question
  // can take multiple rounds when it chains tool calls) — both counters below are incremented
  // by this, not by a flat 1, so the global cap tracks real quota consumption rather than
  // undercounting a multi-tool-round exchange.
  let geminiCallsThisRequest = 0;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callGemini(geminiKey, contents);
      geminiCallsThisRequest += 1;

      const candidate = response.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) {
        finalText = parts.map((p) => p.text || '').join('\n').trim();
        break;
      }

      contents.push({ role: 'model', parts });

      const responseParts: GeminiPart[] = [];
      for (const part of functionCalls) {
        const call = part.functionCall!;
        const result = await executeTool(call.name, call.args || {}, client);
        if (call.name === 'generate_summary_report') {
          structured.push({ tool: call.name, result });
        }
        responseParts.push({ functionResponse: { name: call.name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responseParts });

      if (round === MAX_TOOL_ROUNDS - 1) {
        finalText = "I've gathered the information but hit my step limit before finishing — please ask again or narrow the request.";
      }
    }
  } catch (err) {
    console.error('assistant-demo error:', err);
    return json({ error: `Demo assistant request failed: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }

  // Increment both counters only now that at least one Gemini call actually succeeded — a
  // request that fails before this point (e.g. the very first call errors) never touches either
  // counter, matching the "only on a successful Gemini call" rule.
  const newSessionUsed = sessionRequestsUsed + geminiCallsThisRequest;
  const newGlobalUsed = globalRequestsUsed + geminiCallsThisRequest;
  const nowIso = new Date().toISOString();

  const [{ error: sessionUpsertError }, { error: globalUpsertError }] = await Promise.all([
    client.from('gemini_session_usage').upsert(
      {
        session_id: sessionId,
        usage_date: today,
        requests_used: newSessionUsed,
        first_request_at: sessionRowRaw ? undefined : nowIso,
        last_request_at: nowIso,
      },
      { onConflict: 'session_id,usage_date' }
    ),
    client.from('gemini_daily_budget').upsert(
      { usage_date: today, requests_used: newGlobalUsed },
      { onConflict: 'usage_date' }
    ),
  ]);
  if (sessionUpsertError) console.error('gemini_session_usage upsert notice:', sessionUpsertError.message);
  if (globalUpsertError) console.error('gemini_daily_budget upsert notice:', globalUpsertError.message);

  return json({
    reply: finalText,
    structured,
    sessionRequestsRemaining: Math.max(0, SESSION_DAILY_CAP - newSessionUsed),
    sessionRequestsCap: SESSION_DAILY_CAP,
  });
});
