import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-slate-900 border border-amber-700/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-amber-950/30 border-b border-amber-800/40 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">
              Proceeding despite {overrides.length > 1 ? `${overrides.length} recommendations` : overrides[0]?.what}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              This isn't blocked — it's just recorded to the audit trail, since that's what a GDP audit expects.
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1 rounded hover:bg-slate-800 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="space-y-2">
            {overrides.map((o, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{o.what}</div>
                <div>
                  <span className="text-slate-500">Recommended: </span>
                  <span className="text-slate-300">{o.recommended}</span>
                </div>
                <div>
                  <span className="text-slate-500">Proceeding with: </span>
                  <span className="text-amber-300 font-semibold">{o.chosen}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Existing carrier contract, customer requirement…"
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs resize-none focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
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
