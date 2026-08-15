import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Filter, 
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
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

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg mb-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Immutable Regulatory Audit Trail
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cryptographically Verified
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Slide 10: "Every lane update, compliance check, and alert is timestamped and logged automatically — exportable to CSV"
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Audit Log to CSV</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor, action, lane code, or keyword..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 text-slate-100 text-xs rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-slate-950 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Event Categories</option>
          <option value="TEMPERATURE_MONITORING">Temperature Excursions & Probes</option>
          <option value="LANE_CONFIGURATION">Lane Provisions & Setup</option>
          <option value="GDP_AUDIT">GDP Certifications & Audits</option>
          <option value="ALERT_ACKNOWLEDGED">Alert Acknowledgments</option>
          <option value="CAPA_LOGGED">CAPA Investigations</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Timestamp (UTC)</th>
              <th className="py-2.5 px-3">Actor & Role</th>
              <th className="py-2.5 px-3">Lane ID</th>
              <th className="py-2.5 px-3">Event Action</th>
              <th className="py-2.5 px-3">Operational Details</th>
              <th className="py-2.5 px-3">Verification Hash</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No audit trail records match the search filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-200">{log.actor}</div>
                    <div className="text-[10px] text-slate-400">{log.role}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-teal-400 whitespace-nowrap">
                    {log.laneCode}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-100">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    {log.hash}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
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
