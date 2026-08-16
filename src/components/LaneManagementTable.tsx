import React, { useEffect, useRef, useState } from 'react';
import {
  Plane,
  Ship,
  Truck,
  Layers,
  ChevronRight,
  Thermometer,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Activity,
  PlusCircle,
  Eye,
  Route as RouteIcon,
  Pencil,
  AlertOctagon,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Rows3,
  Rows4,
} from 'lucide-react';
import { TransportLane, TransportMode, RiskLevel } from '../types';
import { getRiskColor, getStatusColor, getGdpBadge, formatCurrency } from '../utils/formatters';
import { getEffectiveRiskLevel, getEffectiveRiskScore } from '../utils/laneRisk';
import { TemperatureSparkline } from './TemperatureSparkline';

// Distinct icon per risk level so the Composite Risk badge can never be mistaken for the
// GDP Status badge next to it, even when both happen to render in the same color.
function getRiskIcon(level: RiskLevel) {
  switch (level) {
    case 'Critical':
      return <AlertOctagon className="w-3 h-3" />;
    case 'High':
      return <AlertTriangle className="w-3 h-3" />;
    case 'Medium':
      return <AlertCircle className="w-3 h-3" />;
    default:
      return <CheckCircle2 className="w-3 h-3" />;
  }
}

interface LaneManagementTableProps {
  lanes: TransportLane[];
  selectedLaneId: string | null;
  onSelectLane: (lane: TransportLane) => void;
  onOpenTempMonitor: (lane: TransportLane) => void;
  onOpenNewLaneWizard: () => void;
  onManageStops: (lane: TransportLane) => void;
  onEditLane: (lane: TransportLane) => void;
}

export const LaneManagementTable: React.FC<LaneManagementTableProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
  onOpenTempMonitor,
  onOpenNewLaneWizard,
  onManageStops,
  onEditLane,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | TransportMode>('ALL');
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return (localStorage.getItem('pharmatrack-lane-table-density') as 'comfortable' | 'compact') || 'comfortable';
  });
  useEffect(() => {
    localStorage.setItem('pharmatrack-lane-table-density', density);
  }, [density]);
  const rowPad = density === 'compact' ? 'py-1.5' : 'py-3.5';

  // Hick's Law: only one primary action ("Assess Risks") stays visible per row; Edit / Manage
  // Stops / Live Telemetry move into a single overflow menu.
  const [openMenuLaneId, setOpenMenuLaneId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuLaneId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredByTab = lanes.filter(l => {
    if (activeTab === 'ALL') return true;
    return l.mode === activeTab;
  });

  const getModeIcon = (mode: TransportMode) => {
    switch (mode) {
      case 'Air':
        return <Plane className="w-4 h-4 text-sky-400" />;
      case 'Sea':
        return <Ship className="w-4 h-4 text-blue-400" />;
      case 'Road':
        return <Truck className="w-4 h-4 text-amber-400" />;
      case 'Multimodal':
        return <Layers className="w-4 h-4 text-purple-400" />;
    }
  };

  const airCount = lanes.filter(l => l.mode === 'Air').length;
  const seaCount = lanes.filter(l => l.mode === 'Sea').length;
  const roadCount = lanes.filter(l => l.mode === 'Road').length;
  const multiCount = lanes.filter(l => l.mode === 'Multimodal').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg mb-6 overflow-hidden">
      
      {/* Table Header & Mode Tabs */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            Multi-Mode Transport Lanes & Risk Scoring
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
              {filteredByTab.length} Lanes Shown
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Unified real-time tracking of thermal integrity, carrier reliability, and composite risk index
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>All Modes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {lanes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Air')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Air'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-sky-400" />
            <span>Air</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {airCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Sea')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Sea'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ship className="w-3.5 h-3.5 text-blue-400" />
            <span>Sea</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {seaCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Road')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Road'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Road</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {roadCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Multimodal')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Multimodal'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Multimodal</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {multiCount}
            </span>
          </button>
        </div>

        {/* Density Toggle */}
        <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs flex-shrink-0">
          <button
            onClick={() => setDensity('comfortable')}
            aria-pressed={density === 'comfortable'}
            title="Comfortable row spacing"
            className={`min-w-[36px] min-h-[32px] px-2 rounded-md flex items-center justify-center transition-all ${
              density === 'comfortable' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDensity('compact')}
            aria-pressed={density === 'compact'}
            title="Compact row spacing"
            className={`min-w-[36px] min-h-[32px] px-2 rounded-md flex items-center justify-center transition-all ${
              density === 'compact' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rows4 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Route & Code</th>
              <th className="py-3 px-4">Payload & Carrier</th>
              <th className="py-3 px-4">Transit Progress</th>
              <th className="py-3 px-4">Live Temperature</th>
              <th className="py-3 px-4">GDP Status</th>
              <th className="py-3 px-4">Composite Risk</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredByTab.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No transport lanes found matching the selected criteria.
                </td>
              </tr>
            ) : (
              filteredByTab.map((lane) => {
                const isSelected = selectedLaneId === lane.id;
                const effectiveRiskLevel = getEffectiveRiskLevel(lane);
                const effectiveRiskScore = getEffectiveRiskScore(lane);
                const riskStyles = getRiskColor(effectiveRiskLevel);
                const statusStyles = getStatusColor(lane.status);
                const gdpBadge = getGdpBadge(lane.gdpStatus);
                const isTempExcursion = lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin;

                return (
                  <tr
                    key={lane.id}
                    className={`hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                      isSelected ? 'bg-slate-800/70 border-l-4 border-l-emerald-500' : ''
                    }`}
                    onClick={() => onSelectLane(lane)}
                  >
                    {/* Route & Code */}
                    <td className={`${rowPad} px-4`}>
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-slate-700">
                          {getModeIcon(lane.mode)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                            <span>{lane.originIata}</span>
                            {lane.stops.map((s) => (
                              <React.Fragment key={s.id}>
                                <span className="text-slate-600 font-normal">›</span>
                                <span className="text-slate-400 text-xs">{s.iata}</span>
                              </React.Fragment>
                            ))}
                            <span className="text-slate-500 font-normal">→</span>
                            <span>{lane.destinationIata}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {lane.laneCode} • {lane.originCity} to {lane.destinationCity}
                            {lane.stops.length > 0 && ` • ${lane.stops.length} stop${lane.stops.length > 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Payload & Carrier */}
                    <td className={`${rowPad} px-4`}>
                      <div className="font-semibold text-slate-200">{lane.productName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-teal-400 font-medium">{lane.carrier}</span>
                        <span>•</span>
                        <span>{formatCurrency(lane.payloadValueUsd)}</span>
                      </div>
                    </td>

                    {/* Transit Progress */}
                    <td className={`${rowPad} px-4 w-44`}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-300 font-medium">{lane.transitProgress}%</span>
                        <span className="text-slate-400">
                          {lane.delayHours > 0 ? (
                            <span className="text-amber-400 font-medium">+{lane.delayHours}h Delay</span>
                          ) : (
                            'On Schedule'
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            lane.status === 'Temperature Alert'
                              ? 'bg-rose-500'
                              : lane.delayHours > 0
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${lane.transitProgress}%` }}
                        />
                      </div>
                    </td>

                    {/* Live Temperature */}
                    <td className={`${rowPad} px-4`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                          isTempExcursion
                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                            : lane.currentTemp >= lane.tempMax - 0.5
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          <Thermometer className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-mono font-bold text-sm ${
                            isTempExcursion ? 'text-rose-400' : 'text-slate-100'
                          }`}>
                            {lane.currentTemp}°C
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Target: {lane.tempMin}°C to {lane.tempMax}°C
                          </div>
                        </div>
                        <TemperatureSparkline history={lane.temperatureHistory} tempMin={lane.tempMin} tempMax={lane.tempMax} />
                      </div>
                    </td>

                    {/* GDP Status */}
                    <td className={`${rowPad} px-4`}>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${gdpBadge.class}`}>
                        {lane.gdpStatus === 'Compliant' ? (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                        )}
                        {lane.gdpComplianceRate}%
                      </span>
                    </td>

                    {/* Composite Risk Score */}
                    <td className={`${rowPad} px-4`}>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${effectiveRiskScore}%`,
                              backgroundColor: riskStyles.fill,
                            }}
                          />
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${riskStyles.badge}`}>
                          {getRiskIcon(effectiveRiskLevel)}
                          {effectiveRiskScore}% {effectiveRiskLevel}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className={`${rowPad} px-4`}>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusStyles.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyles.dot}`} />
                        {lane.status}
                      </span>
                    </td>

                    {/* Actions: 1 primary action visible (Hick's Law), the rest behind a single overflow menu */}
                    <td className={`${rowPad} px-4 text-right relative`}>
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectLane(lane)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-all flex items-center gap-1"
                          title="Open Risk Assessment & Selection Window"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Assess Risks</span>
                        </button>

                        <button
                          onClick={() => setOpenMenuLaneId(openMenuLaneId === lane.id ? null : lane.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                          title="More actions"
                          aria-label={`More actions for ${lane.laneCode}`}
                          aria-expanded={openMenuLaneId === lane.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuLaneId === lane.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-4 top-full mt-1 w-56 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl z-30 py-1 text-left animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={() => {
                                onEditLane(lane);
                                setOpenMenuLaneId(null);
                              }}
                              className="w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              <span>Edit Lane (reroute, carrier, cargo)</span>
                            </button>
                            <button
                              onClick={() => {
                                onManageStops(lane);
                                setOpenMenuLaneId(null);
                              }}
                              className="w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <RouteIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              <span>Manage Route Stops</span>
                            </button>
                            <button
                              onClick={() => {
                                onOpenTempMonitor(lane);
                                setOpenMenuLaneId(null);
                              }}
                              className="w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <Activity className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                              <span>View Live Temperature Telemetry</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time continuous GPS & sensor logging active</span>
        </div>
        <button
          onClick={onOpenNewLaneWizard}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Configure New Transport Lane</span>
        </button>
      </div>

    </div>
  );
};
