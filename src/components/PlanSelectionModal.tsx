import React from 'react';
import { X, Check, Sparkles, Building2, User } from 'lucide-react';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface PlanSelectionModalProps {
  onClose: () => void;
  /** Fires regardless of which tier is picked — none of them charge anything. This exists to
   *  frame why you're about to hit a sign-up form, not to actually gate by tier. */
  onContinue: () => void;
  /** 'advanced' when reached by trying to unlock Advanced mode from Simple/Demo, 'signin' when
   *  reached directly from the landing page's "Sign in" button — same modal, different framing
   *  for why an account is about to be asked for. */
  context?: 'advanced' | 'signin';
}

interface PlanTier {
  id: 'free' | 'pro' | 'enterprise';
  icon: React.ReactNode;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  accent: string;
}

const TIERS: PlanTier[] = [
  {
    id: 'free',
    icon: <User className="w-5 h-5" />,
    name: 'Free',
    price: '$0',
    tagline: 'A single account, full Advanced console',
    features: ['Lane Risk Management table', 'Per-leg carrier assignment', 'Mid-transit disruption reporting', 'GDP Compliance Trends'],
    accent: 'emerald',
  },
  {
    id: 'pro',
    icon: <Sparkles className="w-5 h-5" />,
    name: 'Pro',
    price: '$0',
    tagline: 'Everything in Free, for a real team',
    features: ['Everything in Free', 'Role-based access (Quality Lead, GDP Auditor, etc.)', 'Automated compliance reporting', 'Real-time carrier telemetry'],
    accent: 'teal',
  },
  {
    id: 'enterprise',
    icon: <Building2 className="w-5 h-5" />,
    name: 'Enterprise',
    price: '$0',
    tagline: 'Everything in Pro, at scale',
    features: ['Everything in Pro', 'Immutable 21 CFR Part 11 audit trail', 'CAPA & certification management', 'Priority support (not wired up yet)'],
    accent: 'purple',
  },
];

const ACCENT_CLASSES: Record<string, { light: string; dark: string; iconLight: string; iconDark: string }> = {
  emerald: { light: 'border-emerald-300 bg-emerald-50', dark: 'border-emerald-500/40 bg-emerald-500/10', iconLight: 'bg-emerald-100 text-emerald-600', iconDark: 'bg-emerald-500/20 text-emerald-400' },
  teal: { light: 'border-teal-300 bg-teal-50', dark: 'border-teal-500/40 bg-teal-500/10', iconLight: 'bg-teal-100 text-teal-600', iconDark: 'bg-teal-500/20 text-teal-400' },
  purple: { light: 'border-purple-300 bg-purple-50', dark: 'border-purple-500/40 bg-purple-500/10', iconLight: 'bg-purple-100 text-purple-600', iconDark: 'bg-purple-500/20 text-purple-400' },
};

/**
 * Shown when a logged-out visitor tries to reach Advanced mode / Lane Management / Compliance /
 * Audit Trail. Not a real payment flow — every tier is $0 and leads to the exact same place
 * (real sign-up/sign-in); this exists purely to explain what's behind the login before asking
 * for an account, not to actually gate functionality by which card gets clicked.
 */
export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({ onClose, onContinue, context = 'advanced' }) => {
  const t = useThemeTokens();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className={`w-full max-w-3xl ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>

        <div className={`p-5 sm:p-6 border-b ${t.border} flex items-start justify-between gap-4`}>
          <div>
            <h2 className={`text-lg font-bold ${t.textPrimary}`}>
              {context === 'advanced' ? 'Advanced mode needs an account' : 'Choose how you\'ll use PharmaTrack'}
            </h2>
            <p className={`text-xs mt-1 ${t.textMuted}`}>
              None of these charge anything — every tier is free and leads to the same sign-up. This is just to show what's
              behind the login before asking for one. Simple mode stays fully open with no account, always.
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg flex-shrink-0 ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((tier) => {
            const accent = ACCENT_CLASSES[tier.accent];
            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-4 flex flex-col justify-between ${t.light ? accent.light : accent.dark}`}
              >
                <div>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${t.light ? accent.iconLight : accent.iconDark}`}>
                    {tier.icon}
                  </div>
                  <div className={`text-sm font-bold ${t.textPrimary}`}>{tier.name}</div>
                  <div className={`text-2xl font-black mt-1 ${t.textPrimary}`}>{tier.price}<span className={`text-xs font-medium ${t.textFaint}`}> /mo</span></div>
                  <p className={`text-[11px] mt-1 mb-3 ${t.textMuted}`}>{tier.tagline}</p>
                  <ul className="space-y-1.5 mb-4">
                    {tier.features.map((f) => (
                      <li key={f} className={`text-[11px] flex items-start gap-1.5 ${t.textSecondary}`}>
                        <Check className={`w-3 h-3 flex-shrink-0 mt-0.5 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={onContinue}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                    t.light ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-white hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  Continue with {tier.name}
                </button>
              </div>
            );
          })}
        </div>

        <div className={`px-5 sm:px-6 pb-5 sm:pb-6 text-[11px] text-center ${t.textFaint}`}>
          No payment information is collected anywhere in this flow.
        </div>
      </div>
    </div>
  );
};
