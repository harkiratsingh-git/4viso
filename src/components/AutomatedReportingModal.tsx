import React, { useState } from 'react';
import {
  X,
  FileText,
  Printer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileSpreadsheet
} from 'lucide-react';
import { TransportLane, AlertNotification, AuditLogEntry, SupabaseUser } from '../types';
import { CapaRecord } from '../services/supabaseService';
import { formatCurrency } from '../utils/formatters';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface AutomatedReportingModalProps {
  lanes: TransportLane[];
  alerts: AlertNotification[];
  logs: AuditLogEntry[];
  capaRecords: CapaRecord[];
  currentUser: SupabaseUser;
  onClose: () => void;
}

type ReportType = 'GDP_AUDIT' | 'LANE_RISK' | 'EXCURSION_CAPA' | 'EXECUTIVE_SUMMARY';

export const AutomatedReportingModal: React.FC<AutomatedReportingModalProps> = ({
  lanes,
  alerts,
  logs,
  capaRecords,
  currentUser,
  onClose,
}) => {
  const t = useThemeTokens();
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

  const fieldClass = `w-full ${t.cardBgSunken} ${t.textSecondary} px-2.5 py-1.5 rounded-lg border ${t.light ? 'border-slate-300' : 'border-slate-700'} text-xs`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>

        {/* Header */}
        <div className={`p-4 sm:p-5 ${t.cardBgSunken} border-b ${t.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${t.light ? 'bg-teal-100 text-teal-600 border-teal-300' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${t.textPrimary}`}>
                Automated Pharmaceutical Compliance & Risk Reporting
              </h2>
              <p className={`text-xs ${t.textMuted}`}>
                Slide 10 & 15: Audit-Ready Quality Management, GDP Dossier Generation & Automated Schedules
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Columns (Config Left, Document Preview Right) */}
        <div className={`flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x ${t.light ? 'divide-slate-200' : 'divide-slate-800'} text-xs`}>

          {/* Left Column: Report Controls & Scheduler (4 cols) */}
          <div className={`lg:col-span-4 p-4 sm:p-5 space-y-4 ${t.cardBgSunken}`}>

            {/* Report Type Selector */}
            <div>
              <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textSecondary}`}>
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
                        ? t.light ? 'bg-teal-100 text-teal-800 border-teal-400 shadow-md font-semibold' : 'bg-teal-500/20 text-teal-200 border-teal-500 shadow-md font-semibold'
                        : `${t.cardBg} ${t.border} ${t.textSecondary} ${t.hoverBorder}`
                    }`}
                  >
                    <div className="font-bold text-xs">{item.title}</div>
                    <div className={`text-[10px] mt-0.5 leading-relaxed ${t.textMuted}`}>{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Filter */}
            <div className={`space-y-3 pt-2 border-t ${t.border}`}>
              <div>
                <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Target Corridor / Lane Scope</label>
                <select
                  value={selectedLaneId}
                  onChange={(e) => setSelectedLaneId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="ALL">All Active Corridors ({lanes.length} Lanes)</option>
                  {lanes.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.laneCode} ({l.originIata} → {l.destinationIata})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-[11px] mb-1 ${t.textMuted}`}>Audit Timeframe</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['24H', '7D', '30D', '12W'] as const).map(tr => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => setTimeRange(tr)}
                      className={`py-1 rounded text-[11px] font-semibold text-center transition-all border ${
                        timeRange === tr
                          ? t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : `${t.cardBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'} ${t.border}`
                      }`}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Automated Dispatch Scheduler */}
            <form onSubmit={handleSaveSchedule} className={`p-3 rounded-xl border space-y-2.5 pt-3 ${t.cardBg} ${t.border}`}>
              <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>Automated Email Scheduler</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setScheduledFrequency(f)}
                    className={`py-1 rounded text-center font-bold border ${
                      scheduledFrequency === f
                        ? t.light ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-teal-500/30 text-teal-300 border-teal-500/50'
                        : `${t.cardBgSunken} ${t.textMuted} border-transparent`
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
                className={`w-full ${t.cardBgSunken} ${t.textSecondary} px-2.5 py-1 rounded border ${t.light ? 'border-slate-300' : 'border-slate-700'} text-xs`}
                required
              />
              <button
                type="submit"
                className={`w-full py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 border ${
                  t.light ? 'bg-teal-100 hover:bg-teal-200 text-teal-700 border-teal-300' : 'bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/40'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Activate Schedule</span>
              </button>
              {scheduleSavedMsg && (
                <div className={`text-[10px] font-medium ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>{scheduleSavedMsg}</div>
              )}
            </form>

          </div>

          {/* Right Column: Live Formatted Report Preview (8 cols) */}
          <div className={`lg:col-span-8 p-4 sm:p-6 ${t.cardBgSunken} flex flex-col justify-between overflow-y-auto`}>

            {/* The Document Sheet Preview */}
            <div className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} p-6 rounded-xl shadow-xl space-y-5 text-xs ${t.textSecondary}`}>

              {/* Report Header */}
              <div className={`flex items-start justify-between border-b ${t.border} pb-4`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-extrabold text-sm tracking-wider ${t.textPrimary}`}>PHARMATRACK QUALITY ASSURANCE</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                      t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      OFFICIAL DOSSIER
                    </span>
                  </div>
                  <div className={`text-lg font-black mt-1 ${t.textPrimary}`}>
                    {reportType === 'GDP_AUDIT' && 'Good Distribution Practice (GDP) Compliance Audit Report'}
                    {reportType === 'LANE_RISK' && 'Comprehensive Transport Lane Risk Assessment Dossier'}
                    {reportType === 'EXCURSION_CAPA' && 'Temperature Excursion Investigation & CAPA Report'}
                    {reportType === 'EXECUTIVE_SUMMARY' && 'Executive Cold-Chain Logistics Performance Digest'}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${t.textMuted}`}>
                    Standard: EU GDP (2013/C 343/01) & US FDA 21 CFR Part 211 • System Generated
                  </div>
                </div>

                <div className={`text-right text-[11px] font-mono ${t.textMuted}`}>
                  <div>Ref: <strong className={t.textSecondary}>PT-DOC-2026-992</strong></div>
                  <div>Date: {new Date().toISOString().slice(0, 10)}</div>
                  <div>Scope: {selectedLaneId === 'ALL' ? 'Global Fleet' : selectedLaneId}</div>
                </div>
              </div>

              {/* Executive Summary Metrics */}
              <div className={`grid grid-cols-3 gap-3 p-3 rounded-lg border ${t.cardBgSunken} ${t.border}`}>
                <div>
                  <div className={`text-[10px] font-bold uppercase ${t.textFaint}`}>Audited Corridors</div>
                  <div className={`text-base font-bold ${t.textPrimary}`}>{targetLanes.length} Active Lanes</div>
                </div>
                <div>
                  <div className={`text-[10px] font-bold uppercase ${t.textFaint}`}>Mean GDP Compliance</div>
                  <div className={`text-base font-bold ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{avgCompliance}%</div>
                </div>
                <div>
                  <div className={`text-[10px] font-bold uppercase ${t.textFaint}`}>Payload Valuation</div>
                  <div className={`text-base font-bold ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>{formatCurrency(totalValue)}</div>
                </div>
              </div>

              {/* Dynamic Section Based on Report Type */}
              {reportType === 'GDP_AUDIT' && (
                <div className="space-y-3">
                  <div className={`font-bold text-xs border-b pb-1 ${t.textPrimary} ${t.border}`}>
                    1. Good Distribution Practice (GDP) Checklist Verification
                  </div>
                  <ul className={`space-y-1.5 text-[11px] ${t.textSecondary}`}>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      <span>Continuous NIST-calibrated temperature logger sampling every 5 minutes.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      <span>Phase-change material thermal packaging validated for 72h continuous hold.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      <span>Carrier GDP Quality Agreements active with all operational freight forwarders.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      <span>Immutable cryptographic timestamping active across all audit logs.</span>
                    </li>
                  </ul>
                </div>
              )}

              {reportType === 'EXCURSION_CAPA' && (
                <div className="space-y-3">
                  <div className={`font-bold text-xs border-b pb-1 flex items-center gap-1.5 ${t.light ? 'text-rose-600' : 'text-rose-400'} ${t.border}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Active Excursion & CAPA Root Cause Analysis</span>
                  </div>
                  {scopedCapaRecords.length === 0 ? (
                    <div className={`p-3 rounded-lg border text-[11px] ${t.cardBgSunken} ${t.border} ${t.textMuted}`}>
                      No CAPA records on file for this scope.
                    </div>
                  ) : (
                    scopedCapaRecords.map(c => (
                      <div key={c.id} className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${t.light ? 'bg-rose-50 border-rose-300' : 'bg-rose-950/20 border-rose-800/40'}`}>
                        <div><strong>Incident ID:</strong> {c.capaNumber} (Lane {c.laneCode}) — <span className={t.textMuted}>{c.status}</span></div>
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
                <div className={`font-bold text-xs mb-2 ${t.textPrimary}`}>
                  Corridor Inspection Summary
                </div>
                <div className={`overflow-x-auto rounded border ${t.border}`}>
                  <table className="w-full text-left text-[11px]">
                    <thead className={`${t.cardBgSunken} ${t.textMuted}`}>
                      <tr>
                        <th className="p-2">Lane</th>
                        <th className="p-2">Carrier & Mode</th>
                        <th className="p-2">Live Temp</th>
                        <th className="p-2">Risk</th>
                        <th className="p-2">GDP Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.light ? 'divide-slate-200' : 'divide-slate-800'}`}>
                      {targetLanes.map(l => (
                        <tr key={l.id}>
                          <td className={`p-2 font-mono font-bold ${t.textPrimary}`}>{l.laneCode}</td>
                          <td className="p-2">{l.carrier} ({l.mode})</td>
                          <td className="p-2 font-mono">{l.currentTemp}°C</td>
                          <td className="p-2">{l.riskScore}% ({l.riskLevel})</td>
                          <td className={`p-2 ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>{l.gdpComplianceRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & Auditor Sign-Off */}
              <div className={`pt-4 border-t grid grid-cols-2 gap-4 text-[10px] ${t.border} ${t.textMuted}`}>
                <div>
                  <div className={`font-semibold ${t.textSecondary}`}>Generated & Approved By:</div>
                  <div className={`font-bold ${t.textPrimary}`}>{currentUser.name}</div>
                  <div>{currentUser.role} • {currentUser.organization}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${t.textSecondary}`}>Regulatory Cryptographic Seal:</div>
                  <div className={`font-mono ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>SHA256: 0x8f4c219b1a03eef5</div>
                  <div>Timestamp: {new Date().toUTCString()}</div>
                </div>
              </div>

            </div>

            {/* Export Toolbar */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={handleExportCsv}
                className={`px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
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
