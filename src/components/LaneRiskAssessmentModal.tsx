import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  Plus, 
  Thermometer, 
  Clock, 
  FileText, 
  Truck, 
  CloudLightning, 
  Cpu, 
  Flame, 
  RotateCw, 
  Layers,
  ArrowRight,
  Info,
  Route as RouteIcon,
  Pencil
} from 'lucide-react';
import { TransportLane, RiskFactor, RiskLevel } from '../types';
import { getRiskColor, getStatusColor, formatCurrency } from '../utils/formatters';
import { isLaneExcursing, getEffectiveRiskLevel, getEffectiveRiskScore } from '../utils/laneRisk';
import { LaneCarrierAssignmentPanel } from './LaneCarrierAssignmentPanel';

interface LaneRiskAssessmentModalProps {
  lane: TransportLane;
  onClose: () => void;
  onOpenTempMonitor: (lane: TransportLane) => void;
  onManageStops: (lane: TransportLane) => void;
  onEditLane: (lane: TransportLane) => void;
  onAddRiskFactor: (laneId: string, risk: RiskFactor) => void;
}

export const LaneRiskAssessmentModal: React.FC<LaneRiskAssessmentModalProps> = ({
  lane,
  onClose,
  onOpenTempMonitor,
  onManageStops,
  onEditLane,
  onAddRiskFactor,
}) => {
  const [selectedRiskCategory, setSelectedRiskCategory] = useState<string>('All');
  const [showAddRiskForm, setShowAddRiskForm] = useState<boolean>(false);
  const [newRiskTitle, setNewRiskTitle] = useState<string>('');
  const [newRiskCategory, setNewRiskCategory] = useState<RiskFactor['category']>('Temperature Stability');
  const [newRiskSeverity, setNewRiskSeverity] = useState<RiskFactor['severity']>('Medium');
  const [newRiskDesc, setNewRiskDesc] = useState<string>('');
  const [newRiskMitigation, setNewRiskMitigation] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const effectiveRiskLevel = getEffectiveRiskLevel(lane);
  const effectiveRiskScore = getEffectiveRiskScore(lane);
  const riskStyles = getRiskColor(effectiveRiskLevel);
  const statusStyles = getStatusColor(lane.status);

  const categories = [
    'All',
    'Temperature Stability',
    'Transit Delay',
    'Handling Quality',
    'Regulatory & GDP',
    'Carrier Reliability',
    'Weather & Environment',
  ];

  const filteredRisks = lane.risks.filter(r => {
    if (selectedRiskCategory === 'All') return true;
    return r.category === selectedRiskCategory;
  });

  const handleExecuteMitigation = (riskTitle: string, actionText: string) => {
    setActionSuccessMsg(`Action Dispatched: "${actionText}" executed for "${riskTitle}". Audit trail logged.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleCreateRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiskTitle.trim() || !newRiskDesc.trim()) return;

    const riskScoreMap: Record<RiskLevel, number> = {
      Low: 15,
      Medium: 35,
      High: 65,
      Critical: 90,
    };

    const newRisk: RiskFactor = {
      id: `risk-${Date.now()}`,
      category: newRiskCategory,
      title: newRiskTitle,
      description: newRiskDesc,
      severity: newRiskSeverity,
      score: riskScoreMap[newRiskSeverity],
      likelihood: newRiskSeverity === 'Critical' || newRiskSeverity === 'High' ? 'High' : 'Moderate',
      impact: newRiskSeverity === 'Critical' ? 'Severe' : newRiskSeverity === 'High' ? 'Major' : 'Moderate',
      mitigationStrategy: newRiskMitigation || 'Enforce continuous sensor logging and immediate SOP escalation.',
      recommendedAction: 'Notify carrier operations and monitor next checkpoint.',
    };

    onAddRiskFactor(lane.id, newRisk);
    setNewRiskTitle('');
    setNewRiskDesc('');
    setNewRiskMitigation('');
    setShowAddRiskForm(false);
    setActionSuccessMsg(`Added new risk factor to lane ${lane.laneCode}`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Category Risk Scores for Composite Breakdown
  const categoryBreakdown = [
    {
      name: 'Temperature Stability',
      icon: <Thermometer className="w-4 h-4 text-rose-400" />,
      score: isLaneExcursing(lane) ? 95 : lane.currentTemp > lane.tempMax - 0.5 ? 70 : 12,
      riskLevel: isLaneExcursing(lane) ? 'Critical' : lane.currentTemp > lane.tempMax - 0.5 ? 'High' : 'Low',
      description: 'Thermal inertia of shipper, ambient excursion exposure, reefer uptime.',
    },
    {
      name: 'Transit Delay & Dwell',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      score: lane.delayHours > 24 ? 80 : lane.delayHours > 0 ? 45 : 10,
      riskLevel: lane.delayHours > 24 ? 'Critical' : lane.delayHours > 0 ? 'Medium' : 'Low',
      description: 'Airspace weather detours, port dwell times, ground ramp queues.',
    },
    {
      name: 'Handling & Physical Integrity',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      score: 18,
      riskLevel: 'Low',
      description: 'Pallet drop risk, multi-hub transfers, 3-axis shock/tilt stability.',
    },
    {
      name: 'Regulatory & GDP Compliance',
      icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,
      score: lane.gdpComplianceRate < 70 ? 85 : lane.gdpComplianceRate < 90 ? 35 : 5,
      riskLevel: lane.gdpComplianceRate < 70 ? 'Critical' : lane.gdpComplianceRate < 90 ? 'Medium' : 'Low',
      description: 'Import clearance documentation, calibration certs, chain of custody.',
    },
    {
      name: 'Carrier Reliability',
      icon: <Truck className="w-4 h-4 text-sky-400" />,
      score: 14,
      riskLevel: 'Low',
      description: 'Historical on-time score, fleet modernness, SLA fulfillment rate.',
    },
    {
      name: 'Weather & Environment',
      icon: <CloudLightning className="w-4 h-4 text-orange-400" />,
      score: lane.delayHours > 0 ? 60 : 15,
      riskLevel: lane.delayHours > 0 ? 'High' : 'Low',
      description: 'Severe storm corridors, summer heatwaves, tarmac exposure.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${riskStyles.bg} border ${riskStyles.border}`}>
              <ShieldAlert className={`w-6 h-6 ${riskStyles.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Risk Assessment: {lane.laneCode}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold ${riskStyles.badge}`}>
                  Composite Risk: {effectiveRiskScore}% ({effectiveRiskLevel})
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusStyles.bg}`}>
                  {lane.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                {lane.originCity} ({lane.originIata})
                {lane.stops.map((s) => ` › ${s.city || s.iata} (${s.iata})`).join('')}
                {' '}→ {lane.destinationCity} ({lane.destinationIata}) • {lane.carrier} ({lane.mode})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditLane(lane)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Pencil className="w-4 h-4 text-amber-400" />
              <span>Edit Lane</span>
            </button>
            <button
              onClick={() => onOpenTempMonitor(lane)}
              className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Live Telemetry</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Action Dispatched Toast */}
          {actionSuccessMsg && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 p-3 rounded-lg text-xs text-emerald-200 flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* Top Grid: Key Specs & Safety vs Speed Principle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Cargo & Payload Card */}
            <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Pharmaceutical Payload
              </div>
              <div className="text-sm font-bold text-white mb-0.5">{lane.productName}</div>
              <div className="text-xs text-slate-400 mb-2">Batch: <span className="font-mono text-slate-300">{lane.batchNumber}</span></div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">Total Cargo Value:</span>
                <span className="font-bold text-emerald-400">{formatCurrency(lane.payloadValueUsd)}</span>
              </div>
            </div>

            {/* Thermal Target & Current Status Card */}
            <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Temperature Envelope
              </div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className={`text-xl font-mono font-extrabold ${
                  lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {lane.currentTemp}°C
                </span>
                <span className="text-xs text-slate-400">
                  Target: {lane.tempMin}°C to {lane.tempMax}°C
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-2">MKT: <span className="font-mono text-slate-300">{lane.mktTemp}°C</span> • {lane.tempRangeType}</div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">GDP Compliance:</span>
                <span className={`font-bold ${lane.gdpComplianceRate < 75 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {lane.gdpComplianceRate}% ({lane.gdpStatus})
                </span>
              </div>
            </div>

            {/* Philosophy: Safety Over Speed Card (Slide 11) */}
            <div className="bg-gradient-to-br from-slate-950 to-emerald-950/30 border border-emerald-900/40 p-3.5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Safety Over Speed Policy</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  "Prioritizing safety and thermal reliability ensures safer pharmaceutical transport over simply choosing the fastest lanes."
                </p>
              </div>
              <div className="text-[11px] text-teal-400 mt-2 font-medium flex items-center gap-1">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>Continuous Learning Algorithm Active</span>
              </div>
            </div>

          </div>

          {/* Section: Multi-Stop Route Itinerary */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Route Itinerary ({lane.stops.length + 1} legs)
              </h3>
              <button
                onClick={() => onManageStops(lane)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
              >
                <RouteIcon className="w-3.5 h-3.5" />
                <span>{lane.stops.length > 0 ? 'Manage Stops' : 'Add Stops'}</span>
              </button>
            </div>
            {lane.stops.length === 0 && (
              <p className="text-[11px] text-slate-500 mb-2">Direct route — no intermediate stops yet.</p>
            )}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold flex-shrink-0">O</span>
                  <span className="font-semibold text-slate-200">{lane.originCity} ({lane.originIata})</span>
                  <span className="text-slate-500">Origin</span>
                </div>
                {lane.stops.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs pl-1">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                    <span className="font-semibold text-slate-200">{s.city || s.iata} ({s.iata})</span>
                    <span className="text-slate-500">{s.stopType} • {s.plannedDwellHours}h dwell</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold flex-shrink-0">D</span>
                  <span className="font-semibold text-slate-200">{lane.destinationCity} ({lane.destinationIata})</span>
                  <span className="text-slate-500">Destination</span>
                </div>
              </div>
            </div>

          <LaneCarrierAssignmentPanel lane={lane} />

          {/* Section: Composite Risk Category Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Composite Risk Scoring Breakdown
              </h3>
              <span className="text-xs text-slate-400">
                Calculated across 6 multi-modal risk vectors
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryBreakdown.map((cat) => {
                const catRiskStyles = getRiskColor(cat.riskLevel as RiskLevel);
                return (
                  <div
                    key={cat.name}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                          {cat.icon}
                          <span>{cat.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${catRiskStyles.badge}`}>
                          {cat.score}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                        {cat.description}
                      </p>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.score}%`,
                          backgroundColor: catRiskStyles.fill,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: SELECTION WINDOW - Lists ALL Risks that Particular Lane Could Have */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            
            {/* Header & Filter by Category */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Lane Risk Factor Selection Window
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                    {lane.risks.length} Documented Risks
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select and evaluate all active, latent, or environmental hazards specific to this lane
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Filter Pills */}
                <select
                  value={selectedRiskCategory}
                  onChange={(e) => setSelectedRiskCategory(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddRiskForm(!showAddRiskForm)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Risk</span>
                </button>
              </div>
            </div>

            {/* Optional Add Custom Risk Form */}
            {showAddRiskForm && (
              <form onSubmit={handleCreateRisk} className="mb-4 p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Log New Potential Risk for {lane.laneCode}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Risk Title</label>
                    <input
                      type="text"
                      value={newRiskTitle}
                      onChange={(e) => setNewRiskTitle(e.target.value)}
                      placeholder="e.g. Tarmac Heat Dwell in DXB"
                      required
                      className="w-full bg-slate-950 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                    <select
                      value={newRiskCategory}
                      onChange={(e) => setNewRiskCategory(e.target.value as any)}
                      className="w-full bg-slate-950 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                    >
                      <option value="Temperature Stability">Temperature Stability</option>
                      <option value="Transit Delay">Transit Delay</option>
                      <option value="Handling Quality">Handling Quality</option>
                      <option value="Regulatory & GDP">Regulatory & GDP</option>
                      <option value="Carrier Reliability">Carrier Reliability</option>
                      <option value="Weather & Environment">Weather & Environment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Severity</label>
                    <select
                      value={newRiskSeverity}
                      onChange={(e) => setNewRiskSeverity(e.target.value as any)}
                      className="w-full bg-slate-950 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Description & Root Cause</label>
                  <input
                    type="text"
                    value={newRiskDesc}
                    onChange={(e) => setNewRiskDesc(e.target.value)}
                    placeholder="Specific scenario (e.g. ambient > 40°C during 45min tarmac transit)"
                    required
                    className="w-full bg-slate-950 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Mitigation Strategy / SOP Action</label>
                  <input
                    type="text"
                    value={newRiskMitigation}
                    onChange={(e) => setNewRiskMitigation(e.target.value)}
                    placeholder="e.g. Mandatory cool dolly transfer and VIP thermal blanket wrap"
                    className="w-full bg-slate-950 text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddRiskForm(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                  >
                    Save Risk Factor
                  </button>
                </div>
              </form>
            )}

            {/* List of Risks */}
            <div className="space-y-3">
              {filteredRisks.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No risk factors logged under "{selectedRiskCategory}" for this lane.
                </div>
              ) : (
                filteredRisks.map((risk) => {
                  const itemRiskStyles = getRiskColor(risk.severity);

                  return (
                    <div
                      key={risk.id}
                      className={`p-4 rounded-xl border transition-all ${
                        risk.severity === 'Critical'
                          ? 'bg-rose-950/20 border-rose-800/40'
                          : risk.severity === 'High'
                          ? 'bg-orange-950/20 border-orange-800/40'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${itemRiskStyles.badge}`}>
                            {risk.severity.toUpperCase()} • {risk.score}%
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {risk.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Likelihood: {risk.likelihood} | Impact: {risk.impact}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          ID: {risk.id}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white mb-1">
                        {risk.title}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {risk.description}
                      </p>

                      {/* Mitigation Strategy & Action Button */}
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="text-emerald-400 font-semibold">SOP Mitigation: </span>
                          <span className="text-slate-300">{risk.mitigationStrategy}</span>
                        </div>
                        <button
                          onClick={() => handleExecuteMitigation(risk.title, risk.recommendedAction)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
                        >
                          <span>Execute Mitigation</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Audit Hash: <strong className="font-mono text-slate-300">0x8f4c...eef5 (GDP 2013/C 343/01)</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Assessment
          </button>
        </div>

      </div>
    </div>
  );
};
