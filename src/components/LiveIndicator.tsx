import React from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface LiveIndicatorProps {
  status: 'disabled' | 'connecting' | 'live' | 'reconnecting';
  /** Label to show in 'disabled' (local demo) mode. */
  localLabel?: string;
  className?: string;
}

/**
 * Explicit data-freshness indicator: a pulsing dot only while a Realtime channel is truly
 * connected, so the UI never silently goes stale with no visual cue. Pulse respects
 * prefers-reduced-motion via Tailwind's motion-safe: variant.
 */
export const LiveIndicator: React.FC<LiveIndicatorProps> = ({ status, localLabel = 'Local Simulation', className = '' }) => {
  const t = useThemeTokens();

  if (status === 'disabled') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${t.textMuted} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${t.light ? 'bg-slate-400' : 'bg-slate-600'}`} />
        {localLabel}
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${t.textMuted} ${className}`}>
        <RefreshCw className="w-3 h-3 motion-safe:animate-spin" />
        Connecting…
      </span>
    );
  }

  if (status === 'reconnecting') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${t.light ? 'text-amber-600' : 'text-amber-400'} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" />
        Reconnecting…
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${t.light ? 'text-emerald-600' : 'text-emerald-400'} ${className}`}>
      <Radio className="w-3 h-3 motion-safe:animate-pulse" />
      Live
    </span>
  );
};
