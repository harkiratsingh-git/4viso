// OpenAI adapter — runs the Chat Completions tool-calling loop against the caller's own
// connected key. OpenAI's function.parameters is already standard JSON Schema, so TOOL_SPECS'
// `parameters` is used unchanged, just wrapped in the {type:'function', function:{...}} shape.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { TOOL_SPECS, SYSTEM_PROMPT } from '../toolSchema.ts';
import { executeTool } from '../tools.ts';
import type { AdapterResult, Actor } from './types.ts';

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5';
const MAX_TOOL_ROUNDS = 6;

const OPENAI_TOOLS = TOOL_SPECS.map((spec) => ({
  type: 'function' as const,
  function: { name: spec.name, description: spec.description, parameters: spec.parameters },
}));

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

async function callOpenAi(apiKey: string, messages: OpenAiMessage[]): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, tools: OPENAI_TOOLS, tool_choice: 'auto' }),
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${bodyText.slice(0, 500)}`);
  return JSON.parse(bodyText);
}

export async function runConversation(
  apiKey: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  client: SupabaseClient,
  actor: Actor
): Promise<AdapterResult> {
  const messages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const structured: { tool: string; result: any }[] = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callOpenAi(apiKey, messages);
    const message = response.choices?.[0]?.message;
    const toolCalls: OpenAiToolCall[] = message?.tool_calls || [];

    if (toolCalls.length === 0) {
      finalText = message?.content || '';
      break;
    }

    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await executeTool(call.function.name, args, client, actor);
      if (call.function.name === 'create_lane' || call.function.name === 'generate_summary_report') {
        structured.push({ tool: call.function.name, result });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      finalText = "I've gathered the information but hit my step limit before finishing — please ask again or narrow the request.";
    }
  }

  return { reply: finalText, structured };
}
