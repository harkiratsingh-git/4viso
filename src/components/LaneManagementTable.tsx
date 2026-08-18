import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Carrier, CarrierPerformanceSummary, TransportLane, TransportMode, RiskLevel } from '../types';
import { getRiskColor, getStatusColor, getGdpBadge, formatCurrency } from '../utils/formatters';
import { getEffectiveRiskLevel, getEffectiveRiskScore } from '../utils/laneRisk';
import { getQuickRecommendation } from '../utils/quickRecommendation';
import { TemperatureSparkline } from './TemperatureSparkline';
import { useThemeTokens } from '../contexts/ViewModeContext';

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
  carriers: Carrier[];
  carrierPerformanceById: Map<string, CarrierPerformanceSummary>;
}

export const LaneManagementTable: React.FC<LaneManagementTableProps> = ({
  lanes,
  selectedLaneId,
  onSelectLane,
  onOpenTempMonitor,
  onOpenNewLaneWizard,
  onManageStops,
  onEditLane,
  carriers,
  carrierPerformanceById,
}) => {
  const t = useThemeTokens();
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
  //
  // Rendered via a portal to document.body, positioned with `fixed` + a measured bounding rect,
  // rather than `absolute` inside the table's own markup — the table wrapper below is
  // `overflow-x-auto`, and per the CSS spec setting only overflow-x forces overflow-y to an
  // implicit non-visible value too, so an `absolute` dropdown nested inside it gets silently
  // clipped by that wrapper's bottom edge for most rows. That's the actual "the menu doesn't do
  // anything when clicked" bug — it was opening and immediately being clipped to nothing.
  const [openMenuLaneId, setOpenMenuLaneId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const toggleMenu = (laneId: string, button: HTMLButtonElement) => {
    if (openMenuLaneId === laneId) {
      setOpenMenuLaneId(null);
      setMenuPosition(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuLaneId(laneId);
  };

  const closeMenu = () => {
    setOpenMenuLaneId(null);
    setMenuPosition(null);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const toggleButton = openMenuLaneId ? toggleButtonRefs.current.get(openMenuLaneId) : null;
      if (toggleButton?.contains(target)) return;
      closeMenu();
    }
    // Capture phase so a scroll on the table's inner overflow-x-auto container (scroll events
    // don't bubble) still closes a menu whose fixed-position coordinates would otherwise go stale.
    function handleScroll() {
      closeMenu();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [openMenuLaneId]);

  const filteredByTab = lanes.filter(l => {
    if (activeTab === 'ALL') return true;
    return l.mode === activeTab;
  });

  const getModeIcon = (mode: TransportMode) => {
    switch (mode) {
      case 'Air':
        return <Plane className={`w-4 h-4 ${t.light ? 'text-sky-500' : 'text-sky-400'}`} />;
      case 'Sea':
        return <Ship className={`w-4 h-4 ${t.light ? 'text-blue-500' : 'text-blue-400'}`} />;
      case 'Road':
        return <Truck className={`w-4 h-4 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />;
      case 'Multimodal':
        return <Layers className={`w-4 h-4 ${t.light ? 'text-purple-500' : 'text-purple-400'}`} />;
    }
  };

  const airCount = lanes.filter(l => l.mode === 'Air').length;
  const seaCount = lanes.filter(l => l.mode === 'Sea').length;
  const roadCount = lanes.filter(l => l.mode === 'Road').length;
  const multiCount = lanes.filter(l => l.mode === 'Multimodal').length;

  const countChipClass = `text-[10px] px-1.5 py-0.2 rounded-full ${t.chipBg} ${t.textSecondary}`;
  const tabInactiveClass = `${t.textMuted}`;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-xl shadow-lg mb-6 overflow-hidden`}>

      {/* Table Header & Mode Tabs */}
      <div className={`p-4 border-b ${t.border} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <h2 className={`text-base font-bold ${t.textPrimary} flex items-center gap-2`}>
            Multi-Mode Transport Lanes & Risk Scoring
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal border ${t.chipBg} ${t.textSecondary} ${t.border}`}>
              {filteredByTab.length} Lanes Shown
            </span>
          </h2>
          <p className={`text-xs ${t.textMuted}`}>
            Unified real-time tracking of thermal integrity, carrier reliability, and composite risk index
          </p>
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1.5 ${t.cardBgSunken} p-1 rounded-lg border ${t.border} text-xs overflow-x-auto`}>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ALL'
                ? t.light ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : tabInactiveClass
            }`}
          >
            <span>All Modes</span>
            <span className={countChipClass}>{lanes.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('Air')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Air'
                ? t.light ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : tabInactiveClass
            }`}
          >
            <Plane className={`w-3.5 h-3.5 ${t.light ? 'text-sky-500' : 'text-sky-400'}`} />
            <span>Air</span>
            <span className={countChipClass}>{airCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('Sea')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Sea'
                ? t.light ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : tabInactiveClass
            }`}
          >
            <Ship className={`w-3.5 h-3.5 ${t.light ? 'text-blue-500' : 'text-blue-400'}`} />
            <span>Sea</span>
            <span className={countChipClass}>{seaCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('Road')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Road'
                ? t.light ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : tabInactiveClass
            }`}
          >
            <Truck className={`w-3.5 h-3.5 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />
            <span>Road</span>
            <span className={countChipClass}>{roadCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('Multimodal')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'Multimodal'
                ? t.light ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : tabInactiveClass
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${t.light ? 'text-purple-500' : 'text-purple-400'}`} />
            <span>Multimodal</span>
            <span className={countChipClass}>{multiCount}</span>
          </button>
        </div>

        {/* Density Toggle */}
        <div className={`flex items-center gap-0.5 ${t.cardBgSunken} p-1 rounded-lg border ${t.border} text-xs flex-shrink-0`}>
          <button
            onClick={() => setDensity('comfortable')}
            aria-pressed={density === 'comfortable'}
            title="Comfortable row spacing"
            className={`min-w-[36px] min-h-[32px] px-2 rounded-md flex items-center justify-center transition-all ${
              density === 'comfortable'
                ? t.light ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : tabInactiveClass
            }`}
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDensity('compact')}
            aria-pressed={density === 'compact'}
            title="Compact row spacing"
            className={`min-w-[36px] min-h-[32px] px-2 rounded-md flex items-center justify-center transition-all ${
              density === 'compact'
                ? t.light ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : tabInactiveClass
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
            <tr className={`${t.cardBgSunken} border-b ${t.border} text-[11px] font-bold ${t.textMuted} uppercase tracking-wider`}>
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
          <tbody className={`divide-y ${t.light ? 'divide-slate-200/60' : 'divide-slate-800/60'} text-xs`}>
            {filteredByTab.length === 0 ? (
              <tr>
                <td colSpan={8} className={`py-8 text-center ${t.textMuted}`}>
                  No transport lanes found matching the selected criteria.
                </td>
              </tr>
            ) : (
              filteredByTab.map((lane) => {
                const isSelected = selectedLaneId === lane.id;
                const effectiveRiskLevel = getEffectiveRiskLevel(lane);
                const effectiveRiskScore = getEffectiveRiskScore(lane);
                const riskStyles = getRiskColor(effectiveRiskLevel, t.light);
                const statusStyles = getStatusColor(lane.status, t.light);
                const gdpBadge = getGdpBadge(lane.gdpStatus, t.light);
                const isTempExcursion = lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin;
                const recommendation = getQuickRecommendation(lane, carriers, carrierPerformanceById);

                return (
                  <tr
                    key={lane.id}
                    className={`transition-colors group cursor-pointer ${t.light ? 'hover:bg-slate-100/70' : 'hover:bg-slate-800/40'} ${
                      isSelected ? (t.light ? 'bg-slate-100 border-l-4 border-l-emerald-500' : 'bg-slate-800/70 border-l-4 border-l-emerald-500') : ''
                    }`}
                    onClick={() => onSelectLane(lane)}
                  >
                    {/* Route & Code */}
                    <td className={`${rowPad} px-4`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${t.chipBg} ${t.textSecondary} ${t.light ? 'group-hover:bg-slate-200' : 'group-hover:bg-slate-700'}`}>
                          {getModeIcon(lane.mode)}
                        </div>
                        <div>
                          <div className={`font-bold text-sm flex items-center gap-1.5 flex-wrap ${t.light ? 'text-slate-900' : 'text-white'}`}>
                            <span>{lane.originIata}</span>
                            {lane.stops.map((s) => (
                              <React.Fragment key={s.id}>
                                <span className={`font-normal ${t.textFaint}`}>›</span>
                                <span className={`text-xs ${t.textMuted}`}>{s.iata}</span>
                              </React.Fragment>
                            ))}
                            <span className={`font-normal ${t.textFaint}`}>→</span>
                            <span>{lane.destinationIata}</span>
                          </div>
                          <div className={`text-[11px] font-mono ${t.textMuted}`}>
                            {lane.laneCode} • {lane.originCity} to {lane.destinationCity}
                            {lane.stops.length > 0 && ` • ${lane.stops.length} stop${lane.stops.length > 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Payload & Carrier */}
                    <td className={`${rowPad} px-4`}>
                      <div className={`font-semibold ${t.light ? 'text-slate-800' : 'text-slate-200'}`}>{lane.productName}</div>
                      <div className={`text-[11px] flex items-center gap-1.5 ${t.textMuted}`}>
                        <span className={`font-medium ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{lane.carrier}</span>
                        <span>•</span>
                        <span>{formatCurrency(lane.payloadValueUsd)}</span>
                      </div>
                    </td>

                    {/* Transit Progress */}
                    <td className={`${rowPad} px-4 w-44`}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={`font-medium ${t.light ? 'text-slate-700' : 'text-slate-300'}`}>{lane.transitProgress}%</span>
                        <span className={t.textMuted}>
                          {lane.delayHours > 0 ? (
                            <span className={`font-medium ${t.light ? 'text-amber-600' : 'text-amber-400'}`}>+{lane.delayHours}h Delay</span>
                          ) : (
                            'On Schedule'
                          )}
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${t.chipBg}`}>
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
                            ? t.light ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-rose-500/20 text-rose-400 animate-pulse'
                            : lane.currentTemp >= lane.tempMax - 0.5
                            ? t.light ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'
                            : t.light ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          <Thermometer className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-mono font-bold text-sm ${
                            isTempExcursion ? (t.light ? 'text-rose-600' : 'text-rose-400') : (t.light ? 'text-slate-800' : 'text-slate-100')
                          }`}>
                            {lane.currentTemp}°C
                          </div>
                          <div className={`text-[10px] ${t.textMuted}`}>
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
                          <ShieldCheck className={`w-3 h-3 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        ) : (
                          <ShieldAlert className={`w-3 h-3 ${t.light ? 'text-rose-600' : 'text-rose-400'}`} />
                        )}
                        {lane.gdpComplianceRate}%
                      </span>
                    </td>

                    {/* Composite Risk Score */}
                    <td className={`${rowPad} px-4 max-w-[220px]`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-12 h-2 rounded-full overflow-hidden ${t.chipBg}`}>
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
                      {recommendation && (
                        <div className={`text-[10px] mt-1 leading-snug truncate ${t.light ? 'text-teal-700' : 'text-teal-300'}`} title={recommendation.headline}>
                          Fix: {recommendation.headline}
                        </div>
                      )}
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
                          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 border ${
                            t.light ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                          title="Open Risk Assessment & Selection Window"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Assess Risks</span>
                        </button>

                        <button
                          ref={(el) => {
                            if (el) toggleButtonRefs.current.set(lane.id, el);
                            else toggleButtonRefs.current.delete(lane.id);
                          }}
                          onClick={(e) => toggleMenu(lane.id, e.currentTarget)}
                          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border transition-colors ${
                            t.light ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                          }`}
                          title="More actions"
                          aria-label={`More actions for ${lane.laneCode}`}
                          aria-expanded={openMenuLaneId === lane.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuLaneId === lane.id && menuPosition && createPortal(
                          <div
                            ref={menuRef}
                            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
                            className={`w-56 rounded-lg shadow-2xl z-[100] py-1 text-left animate-in fade-in zoom-in-95 duration-100 border ${
                              t.light ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-700'
                            }`}
                          >
                            <button
                              onClick={() => {
                                onEditLane(lane);
                                closeMenu();
                              }}
                              className={`w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] transition-colors ${
                                t.light ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <Pencil className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-amber-500' : 'text-amber-400'}`} />
                              <span>Edit Lane (reroute, carrier, cargo)</span>
                            </button>
                            <button
                              onClick={() => {
                                onManageStops(lane);
                                closeMenu();
                              }}
                              className={`w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] transition-colors ${
                                t.light ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <RouteIcon className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-purple-500' : 'text-purple-400'}`} />
                              <span>Manage Route Stops</span>
                            </button>
                            <button
                              onClick={() => {
                                onOpenTempMonitor(lane);
                                closeMenu();
                              }}
                              className={`w-full min-h-[40px] px-3 flex items-center gap-2.5 text-[12px] transition-colors ${
                                t.light ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <Activity className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-teal-500' : 'text-teal-400'}`} />
                              <span>View Live Temperature Telemetry</span>
                            </button>
                          </div>,
                          document.body
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
      <div className={`p-3 border-t flex items-center justify-between text-xs ${t.cardBgSunken} ${t.border} ${t.textMuted}`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time continuous GPS & sensor logging active</span>
        </div>
        <button
          onClick={onOpenNewLaneWizard}
          className={`text-xs font-semibold flex items-center gap-1 transition-colors ${t.light ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Configure New Transport Lane</span>
        </button>
      </div>

    </div>
  );
};
