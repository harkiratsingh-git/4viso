import { GdpStatus, LaneStatus, RiskLevel } from '../types';

export function getRiskColor(level: RiskLevel): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  fill: string;
} {
  switch (level) {
    case 'Critical':
      return {
        bg: 'bg-rose-950/40',
        text: 'text-rose-400',
        border: 'border-rose-800/60',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        fill: '#f43f5e',
      };
    case 'High':
      return {
        bg: 'bg-orange-950/40',
        text: 'text-orange-400',
        border: 'border-orange-800/60',
        badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        fill: '#f97316',
      };
    case 'Medium':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-800/60',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        fill: '#f59e0b',
      };
    case 'Low':
    default:
      return {
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-800/60',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        fill: '#10b981',
      };
  }
}

export function getStatusColor(status: LaneStatus): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case 'Temperature Alert':
    case 'Critical':
      return { bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-500' };
    case 'Delayed':
      return { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' };
    case 'Customs Hold':
      return { bg: 'bg-purple-500/10 text-purple-400 border border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' };
    case 'In Transit':
    case 'Active':
      return { bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' };
    case 'Delivered':
      return { bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' };
    default:
      return { bg: 'bg-slate-500/10 text-slate-400 border border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-500' };
  }
}

export function getGdpBadge(status: GdpStatus): { label: string; class: string } {
  switch (status) {
    case 'Compliant':
      return { label: 'GDP Compliant', class: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' };
    case 'Warning':
      return { label: 'GDP Warning', class: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' };
    case 'Non-Compliant':
      return { label: 'GDP Non-Compliant', class: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' };
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
