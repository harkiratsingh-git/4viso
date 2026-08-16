// PharmaTrack conversational assistant — the one endpoint the frontend chat panel calls.
// Holds the Anthropic API key (never exposed to the browser) and the Supabase service-role
// key (also never exposed), and runs the Claude tool-calling loop: Claude decides which
// function to call based on what the user asks, this function executes it against Supabase,
// feeds the result back, and Claude formulates the reply.
//
// Deploy: supabase functions deploy assistant
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.)
import Anthropic from 'npm:@anthropic-ai/sdk@0.32';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { TOOL_DEFINITIONS, executeTool } from './tools.ts';

// Verify this is still current at https://docs.anthropic.com/en/docs/about-claude/models
// before relying on it — model IDs change, and this could not be tested end-to-end without a
// live API key at build time.
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOOL_ROUNDS = 6;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const SYSTEM_PROMPT = `You are the PharmaTrack assistant, embedded in a pharmaceutical cold-chain logistics dashboard used by Quality Leads, GDP Auditors, and Logistics Directors.

Rules:
- ALWAYS call get_dashboard_summary or get_lane_status before answering any factual question about current fleet or lane state (counts, GDP compliance, temperatures, risk, delays). Never answer from general knowledge about what a "typical" value might be — this is a regulated GDP environment and stale or invented numbers are a real compliance problem.
- recommend_route and recommend_carrier are advisory only. Present the recommendation and its reasoning clearly, but never imply the user must follow it. If the user says they want to proceed with something different from the recommendation, that's their call — just make sure they know what they're setting aside and why (route advisory severity, carrier score gap, etc.) so they can make an informed choice.
- Before calling create_lane, make sure you have a real origin, destination, mode, carrier, product name/category, payload value, and temperature range — ask the user for anything missing rather than guessing. If recommend_route/recommend_carrier haven't been called yet for this conversation, consider calling them first so you can tell the user how their choice compares to the recommendation.
- Every corridor advisory has an as_of date. If a tool result includes is_stale: true, you MUST pass its staleness_warning along to the user verbatim before or alongside the advisory content — never present a stale advisory as settled fact.
- generate_summary_report takes a few seconds; let the user know it's running, then share the download link it returns.
- Keep replies concise and concrete — lane codes, numbers, and named reasons, not vague reassurance.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY is not configured on this Edge Function. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment variables were not injected — this should never happen for a deployed function.' }, 500);

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

  const client = createClient(supabaseUrl, serviceRoleKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const resolvedActor = { name: actor?.name || 'PharmaTrack User', role: actor?.role || 'Quality Lead' };

  const conversation: Anthropic.MessageParam[] = messages.map((m: any) => ({ role: m.role, content: m.content }));
  const structured: { tool: string; result: any }[] = [];
  let finalText = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS as Anthropic.Tool[],
        messages: conversation,
      });

      conversation.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        break;
      }

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input, client, resolvedActor);
        if (block.name === 'create_lane' || block.name === 'generate_summary_report') {
          structured.push({ tool: block.name, result });
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }

      conversation.push({ role: 'user', content: toolResults });

      if (round === MAX_TOOL_ROUNDS - 1) {
        finalText = "I've gathered the information but hit my step limit before finishing — please ask again or narrow the request.";
      }
    }
  } catch (err) {
    console.error('assistant error:', err);
    return json({ error: `Assistant request failed: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }

  return json({ reply: finalText, structured });
});
