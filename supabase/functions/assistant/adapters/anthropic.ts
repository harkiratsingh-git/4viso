// Anthropic adapter — runs the Claude tool-calling loop against the caller's own connected key.
// Claude's `input_schema` is already standard JSON Schema, so TOOL_SPECS' `parameters` is used
// unchanged; only the field name differs from the canonical shape.
import Anthropic from 'npm:@anthropic-ai/sdk@0.117';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { TOOL_SPECS, SYSTEM_PROMPT } from '../toolSchema.ts';
import { executeTool } from '../tools.ts';
import type { AdapterResult, Actor } from './types.ts';

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-5';
const MAX_TOOL_ROUNDS = 6;

const CLAUDE_TOOLS: Anthropic.Tool[] = TOOL_SPECS.map((spec) => ({
  name: spec.name,
  description: spec.description,
  input_schema: spec.parameters as Anthropic.Tool.InputSchema,
}));

export async function runConversation(
  apiKey: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  client: SupabaseClient,
  actor: Actor
): Promise<AdapterResult> {
  const anthropic = new Anthropic({ apiKey });
  const conversation: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const structured: { tool: string; result: any }[] = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      // Opus 5 has thinking on by default — 'medium' keeps tool-call accuracy without burning
      // the user's own token budget on deep reasoning a concise ops-dashboard reply doesn't need.
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      tools: CLAUDE_TOOLS,
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
      const result = await executeTool(block.name, block.input, client, actor);
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

  return { reply: finalText, structured };
}
