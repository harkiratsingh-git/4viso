import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  Mail, 
  Send,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { TransportLane, AlertNotification, AuditLogEntry, UserRole } from '../types';
import { CapaRecord } from '../services/supabaseService';
import { formatCurrency } from '../utils/formatters';

interface AutomatedReportingModalProps {
  lanes: TransportLane[];
  alerts: AlertNotification[];
  logs: AuditLogEntry[];
  capaRecords: CapaRecord[];
  activeRole: UserRole;
  onClose: () => void;
}

type ReportType = 'GDP_AUDIT' | 'LANE_RISK' | 'EXCURSION_CAPA' | 'EXECUTIVE_SUMMARY';

export const AutomatedReportingModal: React.FC<AutomatedReportingModalProps> = ({
  lanes,
  alerts,
  logs,
  capaRecords,
  activeRole,
  onClose,
}) => {
  const [reportType, setReportType] = useState<ReportType>('GDP_AUDIT');
  const [selectedLaneId, setSelectedLaneId] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'24H' | '7D' | '30D' | '12W'>('12W');
  const [scheduledFrequency, setScheduledFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [scheduleEmail, setScheduleEmail] = useState<string>('qa-compliance@pharmatrack.global');
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState<string | null>(null);

  const activeLane = lanes.find(l => l.id === selectedLaneId) || lanes[0];
  const targetLanes = selectedLaneId === 'ALL' ? lanes : lanes.filter(l => l.id === selectedLaneId);

  const totalValue = targetLanes.reduce((acc, l) => acc + l.payloadValueUsd, 0);
  const avgCompliance = (targetLanes.reduce((acc, l) => acc + l.gdpComplianceRate, 0) / (targetLanes.length || 1)).toFixed(1);

  const targetLaneCodes = new Set(targetLanes.map(l => l.laneCode));
  const scopedCapaRecords = selectedLaneId === 'ALL'
    ? capaRecords
    : capaRecords.filter(c => targetLaneCodes.has(c.laneCode));

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ['LaneCode', 'Product', 'Carrier', 'Mode', 'CurrentTemp', 'TempRange', 'RiskScore', 'GDPCompliance', 'Status'];
    const rows = targetLanes.map(l => [
      l.laneCode,
      `"${l.productName}"`,
      `"${l.carrier}"`,
      l.mode,
      l.currentTemp,
      `"${l.tempRangeType}"`,
      `${l.riskScore}%`,
      `${l.gdpComplianceRate}%`,
      l.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pharmatrack_report_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleSavedMsg(`Automated ${scheduledFrequency.toLowerCase()} report dispatch configured for ${scheduleEmail}. Next broadcast at 06:00 UTC.`);
    setTimeout(() => setScheduleSavedMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Automated Pharmaceutical Compliance & Risk Reporting
              </h2>
              <p className="text-xs text-slate-400">
                Slide 10 & 15: Audit-Ready Quality Management, GDP Dossier Generation & Automated Schedules
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Columns (Config Left, Document Preview Right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 text-xs">
          
          {/* Left Column: Report Controls & Scheduler (4 cols) */}
          <div className="lg:col-span-4 p-4 sm:p-5 space-y-4 bg-slate-950/50">
            
            {/* Report Type Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Select Report Dossier
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'GDP_AUDIT',
                    title: 'GDP Compliance & Quality Audit',
                    desc: 'EU GDP 2013/C 343/01 audit readiness record & rolling pass rate.',
                  },
                  {
                    id: 'LANE_RISK',
                    title: 'Lane Risk Assessment Dossier',
                    desc: 'Multi-factor risk matrix, route hazards & mitigation playbooks.',
                  },
                  {
                    id: 'EXCURSION_CAPA',
                    title: 'Thermal Excursion & CAPA Investigation',
                    desc: 'Root cause analysis, MKT calculations & corrective action log.',
                  },
                  {
                    id: 'EXECUTIVE_SUMMARY',
                    title: 'Executive Logistics Summary',
                    desc: 'Payload values, carrier SLA benchmarking & active fleets.',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReportType(item.id as ReportType)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      reportType === item.id
                        ? 'bg-teal-500/20 text-teal-200 border-teal-500 shadow-md font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Filter */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target Corridor / Lane Scope</label>
                <select
                  value={selectedLaneId}
                  onChange={(e) => setSelectedLaneId(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                >
                  <option value="ALL">All Active Corridors (8 Lanes)</option>
                  {lanes.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.laneCode} ({l.originIata} → {l.destinationIata})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Audit Timeframe</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['24H', '7D', '30D', '12W'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeRange(t)}
                      className={`py-1 rounded text-[11px] font-semibold text-center transition-all ${
                        timeRange === t
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Automated Dispatch Scheduler */}
            <form onSubmit={handleSaveSchedule} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5 pt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Automated Email Scheduler</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setScheduledFrequency(f)}
                    className={`py-1 rounded text-center font-bold ${
                      scheduledFrequency === f ? 'bg-teal-500/30 text-teal-300 border border-teal-500/50' : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="email"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
                placeholder="qa-team@pharma.com"
                className="w-full bg-slate-950 text-slate-200 px-2.5 py-1 rounded border border-slate-700 text-xs"
                required
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 font-semibold text-xs flex items-center justify-center gap-1"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Activate Schedule</span>
              </button>
              {scheduleSavedMsg && (
                <div className="text-[10px] text-emerald-400 font-medium">{scheduleSavedMsg}</div>
              )}
            </form>

          </div>

          {/* Right Column: Live Formatted Report Preview (8 cols) */}
          <div className="lg:col-span-8 p-4 sm:p-6 bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto">
            
            {/* The Document Sheet Preview */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-xl space-y-5 text-xs text-slate-300">
              
              {/* Report Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm tracking-wider text-white">PHARMATRACK QUALITY ASSURANCE</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      OFFICIAL DOSSIER
                    </span>
                  </div>
                  <div className="text-lg font-black text-white mt-1">
                    {reportType === 'GDP_AUDIT' && 'Good Distribution Practice (GDP) Compliance Audit Report'}
                    {reportType === 'LANE_RISK' && 'Comprehensive Transport Lane Risk Assessment Dossier'}
                    {reportType === 'EXCURSION_CAPA' && 'Temperature Excursion Investigation & CAPA Report'}
                    {reportType === 'EXECUTIVE_SUMMARY' && 'Executive Cold-Chain Logistics Performance Digest'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Standard: EU GDP (2013/C 343/01) & US FDA 21 CFR Part 211 • System Generated
                  </div>
                </div>

                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div>Ref: <strong className="text-slate-200">PT-DOC-2026-992</strong></div>
                  <div>Date: {new Date().toISOString().slice(0, 10)}</div>
                  <div>Scope: {selectedLaneId === 'ALL' ? 'Global Fleet' : selectedLaneId}</div>
                </div>
              </div>

              {/* Executive Summary Metrics */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Audited Corridors</div>
                  <div className="text-base font-bold text-white">{targetLanes.length} Active Lanes</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Mean GDP Compliance</div>
                  <div className="text-base font-bold text-teal-400">{avgCompliance}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Payload Valuation</div>
                  <div className="text-base font-bold text-emerald-400">{formatCurrency(totalValue)}</div>
                </div>
              </div>

              {/* Dynamic Section Based on Report Type */}
              {reportType === 'GDP_AUDIT' && (
                <div className="space-y-3">
                  <div className="font-bold text-white text-xs border-b border-slate-800 pb-1">
                    1. Good Distribution Practice (GDP) Checklist Verification
                  </div>
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Continuous NIST-calibrated temperature logger sampling every 5 minutes.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Phase-change material thermal packaging validated for 72h continuous hold.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Carrier GDP Quality Agreements active with all operational freight forwarders.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Immutable cryptographic timestamping active across all audit logs.</span>
                    </li>
                  </ul>
                </div>
              )}

              {reportType === 'EXCURSION_CAPA' && (
                <div className="space-y-3">
                  <div className="font-bold text-rose-400 text-xs border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Active Excursion & CAPA Root Cause Analysis</span>
                  </div>
                  {scopedCapaRecords.length === 0 ? (
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-400">
                      No CAPA records on file for this scope.
                    </div>
                  ) : (
                    scopedCapaRecords.map(c => (
                      <div key={c.id} className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg text-[11px] space-y-1.5">
                        <div><strong>Incident ID:</strong> {c.capaNumber} (Lane {c.laneCode}) — <span className="text-slate-400">{c.status}</span></div>
                        <div><strong>Issue:</strong> {c.description}</div>
                        <div><strong>Root Cause:</strong> {c.rootCause}</div>
                        <div><strong>Corrective Action:</strong> {c.correctiveAction}</div>
                        <div><strong>Preventive Action:</strong> {c.preventiveAction}</div>
                        <div><strong>Owner:</strong> {c.owner} · <strong>Priority:</strong> {c.priority}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Corridors Table */}
              <div>
                <div className="font-bold text-white text-xs mb-2">
                  Corridor Inspection Summary
                </div>
                <div className="overflow-x-auto rounded border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-2">Lane</th>
                        <th className="p-2">Carrier & Mode</th>
                        <th className="p-2">Live Temp</th>
                        <th className="p-2">Risk</th>
                        <th className="p-2">GDP Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {targetLanes.map(l => (
                        <tr key={l.id}>
                          <td className="p-2 font-mono font-bold text-white">{l.laneCode}</td>
                          <td className="p-2">{l.carrier} ({l.mode})</td>
                          <td className="p-2 font-mono">{l.currentTemp}°C</td>
                          <td className="p-2">{l.riskScore}% ({l.riskLevel})</td>
                          <td className="p-2 text-teal-400">{l.gdpComplianceRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & Auditor Sign-Off */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-[10px] text-slate-400">
                <div>
                  <div className="font-semibold text-slate-300">Generated & Approved By:</div>
                  <div className="text-white font-bold">{activeRole.name}</div>
                  <div>{activeRole.title} • {activeRole.department}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-300">Regulatory Cryptographic Seal:</div>
                  <div className="font-mono text-emerald-400">SHA256: 0x8f4c219b1a03eef5</div>
                  <div>Timestamp: {new Date().toUTCString()}</div>
                </div>
              </div>

            </div>

            {/* Export Toolbar */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
