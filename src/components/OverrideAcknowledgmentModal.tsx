import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useThemeTokens } from '../contexts/ViewModeContext';

export interface PendingOverride {
  /** What's being overridden, e.g. "route recommendation" or "corridor advisory". */
  what: string;
  /** The recommendation/advisory being set aside, e.g. "FedEx Express (score 90)". */
  recommended: string;
  /** What the user is choosing instead, e.g. "MSC (score 50)". */
  chosen: string;
}

interface OverrideAcknowledgmentModalProps {
  overrides: PendingOverride[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Recommendations here are advisory only — this is never a blocker. It exists purely so an
 * override against a route/carrier recommendation or a corridor advisory leaves a real,
 * reasoned record in audit_trail, consistent with the GDP-audit nature of the app. The user
 * can always confirm with no reason given; the record itself is what matters.
 */
export const OverrideAcknowledgmentModal: React.FC<OverrideAcknowledgmentModalProps> = ({
  overrides,
  onCancel,
  onConfirm,
}) => {
  const t = useThemeTokens();
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className={`${t.cardBg} border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${t.light ? 'border-amber-300' : 'border-amber-700/50'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 border-b flex items-start gap-3 ${t.light ? 'bg-amber-50 border-amber-200' : 'bg-amber-950/30 border-amber-800/40'}`}>
          <div className={`p-2 rounded-lg flex-shrink-0 ${t.light ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/15 text-amber-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className={`text-sm font-bold ${t.textPrimary}`}>
              Proceeding despite {overrides.length > 1 ? `${overrides.length} recommendations` : overrides[0]?.what}
            </h2>
            <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>
              This isn't blocked — it's just recorded to the audit trail, since that's what a GDP audit expects.
            </p>
          </div>
          <button onClick={onCancel} className={`ml-auto p-1 rounded flex-shrink-0 ${t.hoverBg} ${t.textMuted}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="space-y-2">
            {overrides.map((o, i) => (
              <div key={i} className={`p-2.5 rounded-lg ${t.cardBgSunken} border ${t.border} space-y-1`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.light ? 'text-amber-600' : 'text-amber-400'}`}>{o.what}</div>
                <div>
                  <span className={t.textFaint}>Recommended: </span>
                  <span className={t.textSecondary}>{o.recommended}</span>
                </div>
                <div>
                  <span className={t.textFaint}>Proceeding with: </span>
                  <span className={`font-semibold ${t.light ? 'text-amber-700' : 'text-amber-300'}`}>{o.chosen}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Existing carrier contract, customer requirement…"
              rows={2}
              className={`w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 ${t.textPrimary} text-xs resize-none focus:outline-none focus:border-amber-500`}
            />
          </div>
        </div>

        <div className={`p-3 border-t flex items-center justify-end gap-2 ${t.cardBgSunken} ${t.border}`}>
          <button
            onClick={onCancel}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="min-h-[36px] px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition-all"
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
