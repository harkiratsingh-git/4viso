import React, { useState } from 'react';
import {
  History,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { AuditLogEntry } from '../types';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const t = useThemeTokens();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter(log => {
    if (filterCategory !== 'ALL' && log.category !== filterCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.laneCode.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Actor', 'Role', 'LaneCode', 'Category', 'Action', 'Details', 'Hash', 'Status'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.actor}"`,
      `"${l.role}"`,
      `"${l.laneCode}"`,
      `"${l.category}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.hash}"`,
      `"${l.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pharmatrack_gdp_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fieldClass = `${t.cardBgSunken} ${t.textPrimary} text-xs rounded-lg border ${t.light ? 'border-slate-300' : 'border-slate-700'} focus:outline-none focus:border-emerald-500`;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-xl p-4 sm:p-5 shadow-lg mb-6`}>

      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b ${t.border}`}>
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${t.light ? 'bg-teal-100 text-teal-600' : 'bg-teal-500/10 text-teal-400'}`}>
              <History className="w-5 h-5" />
            </div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${t.textPrimary}`}>
              Immutable Regulatory Audit Trail
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                <Lock className="w-3 h-3" /> Cryptographically Verified
              </span>
            </h3>
          </div>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
            Slide 10: "Every lane update, compliance check, and alert is timestamped and logged automatically — exportable to CSV"
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className={`px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
            t.light ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Audit Log to CSV</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor, action, lane code, or keyword..."
            className={`w-full pl-8 pr-3 py-1.5 ${fieldClass}`}
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={`px-3 py-1.5 ${fieldClass} ${t.textSecondary}`}
        >
          <option value="ALL">All Event Categories</option>
          <option value="TEMPERATURE_MONITORING">Temperature Excursions & Probes</option>
          <option value="LANE_CONFIGURATION">Lane Provisions & Setup</option>
          <option value="GDP_AUDIT">GDP Certifications & Audits</option>
          <option value="ALERT_ACKNOWLEDGED">Alert Acknowledgments</option>
          <option value="CAPA_LOGGED">CAPA Investigations</option>
          <option value="MITIGATION_EXECUTED">Mitigations Executed</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className={`overflow-x-auto rounded-lg border ${t.border}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className={`${t.cardBgSunken} border-b ${t.border} text-[11px] font-bold uppercase tracking-wider ${t.textFaint}`}>
              <th className="py-2.5 px-3">Timestamp (UTC)</th>
              <th className="py-2.5 px-3">Actor & Role</th>
              <th className="py-2.5 px-3">Lane ID</th>
              <th className="py-2.5 px-3">Event Action</th>
              <th className="py-2.5 px-3">Operational Details</th>
              <th className="py-2.5 px-3">Verification Hash</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.light ? 'divide-slate-200' : 'divide-slate-800/60'} ${t.textSecondary}`}>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className={`py-6 text-center ${t.textMuted}`}>
                  No audit trail records match the search filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className={`transition-colors ${t.hoverBgSubtle}`}>
                  <td className={`py-2.5 px-3 font-mono text-[11px] whitespace-nowrap ${t.textMuted}`}>
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className={`font-semibold ${t.textSecondary}`}>{log.actor}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>{log.role}</div>
                  </td>
                  <td className={`py-2.5 px-3 font-mono font-bold whitespace-nowrap ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>
                    {log.laneCode}
                  </td>
                  <td className={`py-2.5 px-3 font-medium ${t.textPrimary}`}>
                    {log.action}
                  </td>
                  <td className={`py-2.5 px-3 max-w-xs truncate ${t.textSecondary}`} title={log.details}>
                    {log.details}
                  </td>
                  <td className={`py-2.5 px-3 font-mono text-[10px] whitespace-nowrap ${t.textMuted}`}>
                    {log.hash}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                      t.light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    }`}>
                      <CheckCircle2 className={`w-2.5 h-2.5 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
