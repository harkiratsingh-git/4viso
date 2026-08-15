import React from 'react';
import { 
  Radio, 
  AlertOctagon, 
  CheckCircle2, 
  ThermometerSnowflake, 
  TrendingUp, 
  Boxes,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { TransportLane } from '../types';
import { formatCurrency } from '../utils/formatters';

interface KpiOverviewProps {
  lanes: TransportLane[];
  onSelectFilter: (filterKey: string, value: any) => void;
}

export const KpiOverview: React.FC<KpiOverviewProps> = ({ lanes, onSelectFilter }) => {
  const totalLanes = lanes.length;
  const activeLanes = lanes.filter(l => l.status === 'In Transit' || l.status === 'Active').length;
  const highRiskLanes = lanes.filter(l => l.riskScore >= 40 || l.riskLevel === 'High' || l.riskLevel === 'Critical').length;
  const criticalRiskLanes = lanes.filter(l => l.riskLevel === 'Critical').length;
  
  // Calculate weighted or average GDP compliance
  const avgGdpCompliance = totalLanes > 0
    ? (lanes.reduce((acc, l) => acc + l.gdpComplianceRate, 0) / totalLanes).toFixed(1)
    : '0';

  const tempDeviations = lanes.filter(l => {
    return l.status === 'Temperature Alert' || l.currentTemp < l.tempMin || l.currentTemp > l.tempMax;
  }).length;

  const totalValue = lanes.reduce((acc, l) => acc + l.payloadValueUsd, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 mb-6">
      
      {/* Card 1: Active Lanes */}
      <div 
        onClick={() => onSelectFilter('mode', 'All')}
        className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Lanes</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
            <Radio className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight">{activeLanes}</span>
          <span className="text-xs text-slate-400 font-medium">/ {totalLanes} Total</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className="text-emerald-400 font-medium flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> 100% Monitored
          </span>
          <span className="text-slate-500">Air, Sea, Road</span>
        </div>
      </div>

      {/* Card 2: High-Risk Lanes */}
      <div 
        onClick={() => onSelectFilter('riskSeverity', 'High')}
        className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-900/50 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">High-Risk Lanes</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 transition-colors">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-rose-400 tracking-tight">{highRiskLanes}</span>
          {criticalRiskLanes > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {criticalRiskLanes} Critical
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className="text-amber-400 font-medium">Requires Attention</span>
          <span className="text-slate-500 group-hover:text-rose-300 transition-colors flex items-center gap-0.5">
            Inspect <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Card 3: GDP Compliance Rate */}
      <div 
        onClick={() => onSelectFilter('gdpStatus', 'Compliant')}
        className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-900/50 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">GDP Compliance</span>
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 transition-colors">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-teal-400 tracking-tight">{avgGdpCompliance}%</span>
          <span className="text-xs text-emerald-400 font-semibold">+31.7%</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className="text-slate-400">12-Week Rolling</span>
          <span className="text-emerald-400 font-semibold">Audit Ready</span>
        </div>
      </div>

      {/* Card 4: Temperature Deviations */}
      <div 
        onClick={() => onSelectFilter('tempStatus', 'Excursion')}
        className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-900/50 p-4 rounded-xl shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Temp Deviations</span>
          <div className={`p-1.5 rounded-lg ${tempDeviations > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
            <ThermometerSnowflake className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-extrabold tracking-tight ${tempDeviations > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
            {tempDeviations}
          </span>
          <span className="text-xs text-slate-400 font-medium">Active Excursions</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className={tempDeviations > 0 ? 'text-rose-400 font-medium' : 'text-emerald-400'}>
            {tempDeviations > 0 ? 'Excursion in Reefer' : 'All Probes Normal'}
          </span>
          <span className="text-slate-500">Live IoT Feed</span>
        </div>
      </div>

      {/* Card 5: Monitored Payload Value */}
      <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payload In Transit</span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Boxes className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-slate-100 tracking-tight">
            {formatCurrency(totalValue)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
          <span className="text-blue-400 font-medium">Critical Biologics</span>
          <span className="text-slate-500">8 Batches</span>
        </div>
      </div>

    </div>
  );
};
