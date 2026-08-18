import { GdpStatus, LaneStatus, RiskLevel } from '../types';

/** `light` defaults to false (dark) so any call site that hasn't been updated yet keeps its
 * original behavior rather than silently changing — but every badge here used a translucent
 * dark-mode background + light text (e.g. `bg-rose-500/20 text-rose-300`), which goes pale and
 * low-contrast over a white page, so callers rendering in a light theme must pass `true`. */
export function getRiskColor(level: RiskLevel, light = false): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  fill: string;
} {
  switch (level) {
    case 'Critical':
      return light
        ? { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-300', badge: 'bg-rose-100 text-rose-700 border-rose-300', fill: '#e11d48' }
        : { bg: 'bg-rose-950/40', text: 'text-rose-400', border: 'border-rose-800/60', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', fill: '#f43f5e' };
    case 'High':
      return light
        ? { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700 border-orange-300', fill: '#ea580c' }
        : { bg: 'bg-orange-950/40', text: 'text-orange-400', border: 'border-orange-800/60', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', fill: '#f97316' };
    case 'Medium':
      return light
        ? { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-700 border-amber-300', fill: '#d97706' }
        : { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/60', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', fill: '#f59e0b' };
    case 'Low':
    default:
      return light
        ? { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', fill: '#059669' }
        : { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/60', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', fill: '#10b981' };
  }
}

export function getStatusColor(status: LaneStatus, light = false): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case 'Temperature Alert':
    case 'Critical':
      return light
        ? { bg: 'bg-rose-50 text-rose-700 border border-rose-300', text: 'text-rose-600', dot: 'bg-rose-500' }
        : { bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-500' };
    case 'Delayed':
      return light
        ? { bg: 'bg-amber-50 text-amber-700 border border-amber-300', text: 'text-amber-600', dot: 'bg-amber-500' }
        : { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' };
    case 'Customs Hold':
      return light
        ? { bg: 'bg-purple-50 text-purple-700 border border-purple-300', text: 'text-purple-600', dot: 'bg-purple-500' }
        : { bg: 'bg-purple-500/10 text-purple-400 border border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' };
    case 'In Transit':
    case 'Active':
      return light
        ? { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-300', text: 'text-emerald-600', dot: 'bg-emerald-500' }
        : { bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' };
    case 'Delivered':
      return light
        ? { bg: 'bg-blue-50 text-blue-700 border border-blue-300', text: 'text-blue-600', dot: 'bg-blue-500' }
        : { bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' };
    default:
      return light
        ? { bg: 'bg-slate-100 text-slate-700 border border-slate-300', text: 'text-slate-600', dot: 'bg-slate-500' }
        : { bg: 'bg-slate-500/10 text-slate-400 border border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-500' };
  }
}

export function getGdpBadge(status: GdpStatus, light = false): { label: string; class: string } {
  switch (status) {
    case 'Compliant':
      return light
        ? { label: 'GDP Compliant', class: 'bg-emerald-100 text-emerald-700 border border-emerald-300' }
        : { label: 'GDP Compliant', class: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' };
    case 'Warning':
      return light
        ? { label: 'GDP Warning', class: 'bg-amber-100 text-amber-700 border border-amber-300' }
        : { label: 'GDP Warning', class: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' };
    case 'Non-Compliant':
      return light
        ? { label: 'GDP Non-Compliant', class: 'bg-rose-100 text-rose-700 border border-rose-300' }
        : { label: 'GDP Non-Compliant', class: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' };
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
