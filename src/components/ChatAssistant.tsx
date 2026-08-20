import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles, FileDown, ArrowUpRight, AlertTriangle, Loader2 } from 'lucide-react';
import { SupabaseUser } from '../types';
import {
  sendAssistantMessage,
  sendDemoAssistantMessage,
  AssistantMessage,
  AssistantStructuredResult,
  DemoStructuredResult,
  DemoLimitReachedError,
  NoApiKeyConnectedError,
} from '../services/assistantService';
import { getSupabaseClient } from '../services/supabaseService';
import { useThemeTokens, ThemeTokens } from '../contexts/ViewModeContext';

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SupabaseUser;
  dataSource: 'loading' | 'cloud' | 'local';
  isAuthenticated: boolean;
  onLaneCreated: (laneCode: string) => void;
  onRequireSignIn: () => void;
  /** Sent to Settings' AI Provider section — fires when the Advanced assistant reports no
   *  connected key (or an unresolved choice between more than one connected provider). */
  onRequireApiKey: () => void;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  structured?: AssistantStructuredResult[];
  isError?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What's the status of MXP-AMS-002?",
  'How many high-risk lanes do we have right now?',
  'Recommend a route from Frankfurt to Mumbai for cold-chain vaccines',
  'Generate a summary report of everything',
];

function StructuredResultCard({ item, onLaneCreated, t }: { item: AssistantStructuredResult; onLaneCreated: (laneCode: string) => void; t: ThemeTokens }) {
  if (item.tool === 'create_lane' && item.result?.created) {
    const r = item.result;
    return (
      <div className={`mt-2 p-3 rounded-xl border text-xs ${t.light ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/30 border-emerald-800/50'}`}>
        <div className={`flex items-center gap-1.5 font-bold mb-1.5 ${t.light ? 'text-emerald-700' : 'text-emerald-300'}`}>
          <Sparkles className="w-3.5 h-3.5" /> Lane Created: {r.lane_code}
        </div>
        <div className={`grid grid-cols-2 gap-1.5 ${t.textSecondary}`}>
          <div><span className={t.textFaint}>Route: </span>{r.origin} → {r.destination}</div>
          <div><span className={t.textFaint}>Mode: </span>{r.mode}</div>
          <div><span className={t.textFaint}>Carrier: </span>{r.carrier}</div>
          <div><span className={t.textFaint}>Risk: </span>{r.risk_score}% {r.risk_level}</div>
        </div>
        <button
          onClick={() => onLaneCreated(r.lane_code)}
          className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${t.light ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
        >
          View Lane <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (item.tool === 'generate_summary_report' && item.result?.generated) {
    const r = item.result;
    return (
      <div className={`mt-2 p-3 rounded-xl border text-xs ${t.light ? 'bg-teal-50 border-teal-300' : 'bg-teal-950/30 border-teal-800/50'}`}>
        <div className={`flex items-center gap-1.5 font-bold mb-1.5 ${t.light ? 'text-teal-700' : 'text-teal-300'}`}>
          <FileDown className="w-3.5 h-3.5" /> Report Ready
        </div>
        <a
          href={r.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold w-fit ${
            t.light ? 'bg-teal-100 hover:bg-teal-200 border-teal-300 text-teal-700' : 'bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/30 text-teal-300'
          }`}
        >
          <FileDown className="w-3.5 h-3.5" /> Download {r.filename}
        </a>
        <p className={`mt-1.5 ${t.textFaint}`}>Link expires in {r.expires_in_hours}h.</p>
      </div>
    );
  }

  if (item.result?.error) {
    return (
      <div className={`mt-2 p-2.5 rounded-lg border text-[11px] flex items-start gap-1.5 ${
        t.light ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
      }`}>
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{item.result.error}</span>
      </div>
    );
  }

  return null;
}

/**
 * Command-palette-adjacent chat panel — a side drawer, not a separate page. Calls the
 * `assistant` Supabase Edge Function, which holds the Anthropic API key and does the actual
 * tool-calling against live data; this component only renders the conversation.
 */
export const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onClose, currentUser, dataSource, isAuthenticated, onLaneCreated, onRequireSignIn, onRequireApiKey }) => {
  const t = useThemeTokens();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [demoUsage, setDemoUsage] = useState<{ remaining: number; cap: number } | null>(null);
  const [demoLimitMessage, setDemoLimitMessage] = useState<string | null>(null);
  const [noApiKeyMessage, setNoApiKeyMessage] = useState<string | null>(null);
  const isBlocked = !!demoLimitMessage || !!noApiKeyMessage;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, isSending]);

  const actor = { name: currentUser.name, role: currentUser.role };
  // The assistant only needs a configured Supabase project to reach its Edge Function — it
  // doesn't need dataSource === 'cloud' specifically, which just means "real lane data loaded."
  // A demo/local session with no lanes yet still has a real Supabase project behind it and
  // should still be able to talk to the assistant (Part 4: demo mode works without login).
  const notConnected = dataSource === 'loading' || !getSupabaseClient();
  // The Gemini-backed demo assistant (assistant-demo) handles every unauthenticated visitor and
  // any authenticated session that isn't currently viewing real cloud data — same UI, same
  // conversation, a different backend function underneath. Only an authenticated session on
  // cloud data reaches the Claude-backed `assistant` function, which is the only one that can
  // create lanes.
  const useDemoBackend = !isAuthenticated || dataSource !== 'cloud';

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isSending || notConnected || isBlocked) return;

    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(nextTurns);
    setInput('');
    setIsSending(true);

    try {
      const history: AssistantMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.content }));
      if (useDemoBackend) {
        const response = await sendDemoAssistantMessage(history, actor);
        setTurns((prev) => [...prev, { role: 'assistant', content: response.reply, structured: response.structured }]);
        setDemoUsage({ remaining: response.sessionRequestsRemaining, cap: response.sessionRequestsCap });
      } else {
        const response = await sendAssistantMessage(history, actor);
        setTurns((prev) => [...prev, { role: 'assistant', content: response.reply, structured: response.structured }]);
      }
    } catch (err) {
      if (err instanceof DemoLimitReachedError) {
        setDemoLimitMessage(err.message);
        setDemoUsage((prev) => (prev ? { ...prev, remaining: 0 } : { remaining: 0, cap: 0 }));
        setTurns((prev) => [...prev, { role: 'assistant', isError: true, content: err.message }]);
        return;
      }
      if (err instanceof NoApiKeyConnectedError) {
        setNoApiKeyMessage(err.message);
        setTurns((prev) => [...prev, { role: 'assistant', isError: true, content: err.message }]);
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          isError: true,
          content:
            err instanceof Error && err.message.includes('Failed to send a request')
              ? `The assistant isn't reachable — the Supabase Edge Function may not be deployed yet. Ask whoever manages this project's cloud setup to run \`supabase functions deploy ${
                  useDemoBackend ? 'assistant-demo` and set the GEMINI_API_KEY secret' : 'assistant`'
                }.`
              : `The assistant hit an error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-end">
      <div className={`${t.cardBg} border-l ${t.light ? 'border-slate-300' : 'border-slate-700'} w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200`}>
        {/* Header */}
        <div className={`p-4 ${t.cardBgSunken} border-b ${t.border} flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${t.light ? 'bg-teal-100 text-teal-600 border-teal-300' : 'bg-teal-500/15 text-teal-400 border-teal-500/30'}`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${t.textPrimary}`}>PharmaTrack Assistant</h2>
              <p className={`text-[11px] ${t.textMuted}`}>Ask about lanes, get recommendations, generate reports</p>
            </div>
          </div>
          <button onClick={onClose} className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {notConnected && (
          <div className={`mx-4 mt-3 p-2.5 rounded-lg text-[11px] flex items-start gap-2 flex-shrink-0 ${t.cardBgSunken} border ${t.border} ${t.textMuted}`}>
            <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${t.light ? 'text-amber-600' : 'text-amber-400'}`} />
            <span>The assistant needs a connected Supabase project — none is configured right now.</span>
          </div>
        )}

        {!notConnected && useDemoBackend && demoUsage && !isBlocked && (
          <div className={`mx-4 mt-3 flex-shrink-0`}>
            <div className={`flex items-center justify-between text-[10px] mb-1 ${t.textFaint}`}>
              <span>Demo usage</span>
              <span>{Math.max(0, demoUsage.cap - demoUsage.remaining).toLocaleString()} of {demoUsage.cap.toLocaleString()} questions used today</span>
            </div>
            <div className={`w-full h-1 rounded-full overflow-hidden ${t.chipBg}`}>
              <div
                className={`h-full rounded-full ${demoUsage.remaining < demoUsage.cap * 0.2 ? 'bg-amber-500' : 'bg-teal-500'}`}
                style={{ width: `${Math.min(100, Math.round(((demoUsage.cap - demoUsage.remaining) / demoUsage.cap) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {!notConnected && demoLimitMessage && (
          <div className={`mx-4 mt-3 p-3 rounded-lg text-[11px] flex flex-col gap-2 flex-shrink-0 border ${
            t.light ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
          }`}>
            <span>{demoLimitMessage}</span>
            <button
              onClick={onRequireSignIn}
              className={`self-start px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                t.light ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              Sign in
            </button>
          </div>
        )}

        {!notConnected && noApiKeyMessage && (
          <div className={`mx-4 mt-3 p-3 rounded-lg text-[11px] flex flex-col gap-2 flex-shrink-0 border ${
            t.light ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
          }`}>
            <span>{noApiKeyMessage}</span>
            <button
              onClick={onRequireApiKey}
              className={`self-start px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                t.light ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              Open Settings
            </button>
          </div>
        )}

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className={`text-center py-2 ${t.textFaint}`}>Try asking:</p>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  disabled={notConnected || isBlocked}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    t.light ? 'bg-slate-50 border-slate-200 hover:border-teal-400 text-slate-700' : 'bg-slate-950/80 border-slate-800 hover:border-teal-500/40 text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${turn.role === 'user' ? '' : 'w-full'}`}>
                <div
                  className={`px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap ${
                    turn.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : turn.isError
                      ? t.light ? 'bg-rose-50 border border-rose-300 text-rose-700' : 'bg-rose-950/30 border border-rose-800/50 text-rose-200'
                      : `${t.chipBg} ${t.textSecondary}`
                  }`}
                >
                  {turn.content}
                </div>
                {turn.structured?.map((item, j) => (
                  <StructuredResultCard key={j} item={item} onLaneCreated={onLaneCreated} t={t} />
                ))}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className={`px-3 py-2 rounded-xl flex items-center gap-1.5 ${t.chipBg} ${t.textMuted}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className={`p-3 ${t.cardBgSunken} border-t ${t.border} flex items-end gap-2 flex-shrink-0`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              notConnected
                ? 'No Supabase project configured…'
                : demoLimitMessage || noApiKeyMessage
                  ? (demoLimitMessage || noApiKeyMessage) as string
                  : 'Ask about a lane, request a recommendation, or generate a report…'
            }
            disabled={notConnected || isBlocked}
            rows={1}
            className={`flex-1 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-3 py-2 ${t.textPrimary} text-xs resize-none focus:outline-none focus:border-teal-500 disabled:opacity-50`}
          />
          <button
            onClick={() => handleSend()}
            disabled={notConnected || isBlocked || isSending || !input.trim()}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
