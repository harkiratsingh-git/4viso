// Gemini adapter — runs the generateContent tool-calling loop against the caller's own
// connected key. Same request/response shape as ../../assistant-demo (verified live against the
// real API there — see that function's header comment), but with the FULL tool set including
// create_lane, since this is the authenticated Advanced tier, not the capped demo tier.
//
// TOOL_SPECS' `parameters` uses lowercase JSON Schema types (object/string/number/...); Gemini's
// functionDeclarations schema wants uppercase Type enum values, so toGeminiSchema converts.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { TOOL_SPECS, SYSTEM_PROMPT, type JsonSchema } from '../toolSchema.ts';
import { executeTool } from '../tools.ts';
import type { AdapterResult, Actor } from './types.ts';

// gemini-3.5-flash-lite is the model confirmed live and working against the real API while
// building the demo tier (assistant-demo) — gemini-2.5-flash-lite has been retired for new
// callers. BYOK users on a different plan/model can override via secret.
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const MAX_TOOL_ROUNDS = 6;

function toGeminiSchema(schema: JsonSchema): any {
  const out: any = { type: schema.type.toUpperCase() };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

const GEMINI_TOOL_DECLARATIONS = TOOL_SPECS.map((spec) => ({
  name: spec.name,
  description: spec.description,
  parameters: toGeminiSchema(spec.parameters),
}));

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
  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${bodyText.slice(0, 500)}`);
  return JSON.parse(bodyText);
}

export async function runConversation(
  apiKey: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  client: SupabaseClient,
  actor: Actor
): Promise<AdapterResult> {
  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const structured: { tool: string; result: any }[] = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callGemini(apiKey, contents);
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
      const result = await executeTool(call.name, call.args || {}, client, actor);
      if (call.name === 'create_lane' || call.name === 'generate_summary_report') {
        structured.push({ tool: call.name, result });
      }
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responseParts });

    if (round === MAX_TOOL_ROUNDS - 1) {
      finalText = "I've gathered the information but hit my step limit before finishing — please ask again or narrow the request.";
    }
  }

  return { reply: finalText, structured };
}
