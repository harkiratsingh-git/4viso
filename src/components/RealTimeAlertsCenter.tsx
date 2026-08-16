import React, { useState } from 'react';
import {
  X,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  ArrowUpRight,
  Lock
} from 'lucide-react';
import { AlertNotification, TransportLane, SupabaseUser } from '../types';
import { formatTime } from '../utils/dateFormat';
import { LiveIndicator } from './LiveIndicator';

interface RealTimeAlertsCenterProps {
  alerts: AlertNotification[];
  lanes: TransportLane[];
  realtimeStatus: 'disabled' | 'connecting' | 'live' | 'reconnecting';
  currentUserRole?: SupabaseUser['role'];
  onClose: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onSelectLaneByCode: (laneCode: string) => void;
  onOpenReportForAlert: (alert: AlertNotification) => void;
}

const ROLES_THAT_CAN_ACKNOWLEDGE: Array<SupabaseUser['role']> = ['Quality Lead', 'GDP Auditor'];

export const RealTimeAlertsCenter: React.FC<RealTimeAlertsCenterProps> = ({
  alerts,
  lanes,
  realtimeStatus,
  currentUserRole,
  onClose,
  onAcknowledgeAlert,
  onSelectLaneByCode,
  onOpenReportForAlert,
}) => {
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical');
  // Peak-end: briefly show a positive confirmation on the exact card just acknowledged,
  // instead of it silently re-rendering straight into its muted, receded state.
  const [justAcknowledged, setJustAcknowledged] = useState<Set<string>>(new Set());

  const canAcknowledge = !currentUserRole || ROLES_THAT_CAN_ACKNOWLEDGE.includes(currentUserRole);

  const handleAcknowledgeClick = (alertId: string) => {
    onAcknowledgeAlert(alertId);
    setJustAcknowledged(prev => new Set(prev).add(alertId));
    setTimeout(() => {
      setJustAcknowledged(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }, 1800);
  };

  // Unresolved alerts first (critical before warning), acknowledged alerts recede to the
  // bottom regardless of severity — the eye should go straight to what still needs action.
  const severityRank = { Critical: 0, Warning: 1, Info: 2 };
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (a.isAcknowledged !== b.isAcknowledged) return a.isAcknowledged ? 1 : -1;
    return severityRank[a.severity] - severityRank[b.severity];
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <BellRing className="w-5 h-5 motion-safe:animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Real-Time Alert Center</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {criticalAlerts.filter(a => !a.isAcknowledged).length} Unresolved Critical
                </span>
              </div>
              <p className="text-xs text-slate-400">
                24/7 Automated IoT Threshold & Regulatory Deviation Trigger
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            aria-label="Close alert center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canAcknowledge && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span>Your role ({currentUserRole || 'unknown'}) can view alerts but only a Quality Lead or GDP Auditor can acknowledge them.</span>
          </div>
        )}

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {alerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-200">All Corridors Operating Normal</p>
              <p className="text-slate-400 text-[11px] mt-1">No active temperature excursions or transit alerts.</p>
            </div>
          ) : (
            sortedAlerts.map((alert) => {
              const isCritical = alert.severity === 'Critical';
              const showConfirmation = justAcknowledged.has(alert.id);

              return (
                <div
                  key={alert.id}
                  className={`relative p-4 rounded-xl border transition-all ${
                    showConfirmation
                      ? 'bg-emerald-950/30 border-emerald-700/60'
                      : alert.isAcknowledged
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : isCritical
                      ? 'bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/20'
                      : 'bg-amber-950/30 border-amber-800/60 shadow-md shadow-amber-950/20'
                  }`}
                >
                  {showConfirmation && (
                    <div className="absolute inset-0 rounded-xl bg-emerald-950/80 flex items-center justify-center gap-2 text-emerald-300 font-bold text-sm z-10">
                      <CheckCircle2 className="w-5 h-5" />
                      Acknowledged
                    </div>
                  )}

                  {/* Alert Top Bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        alert.isAcknowledged
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : isCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {alert.severity.toUpperCase()}{alert.isAcknowledged ? ' · ACKNOWLEDGED' : ''}
                      </span>
                      <button
                        onClick={() => onSelectLaneByCode(alert.laneCode)}
                        className="font-mono font-bold text-teal-300 hover:underline flex items-center gap-1"
                      >
                        {alert.laneCode} ({alert.route})
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(alert.timestamp)}
                    </span>
                  </div>

                  {/* Title & Message */}
                  <h4 className="font-bold text-sm text-white mb-1">
                    {alert.title}
                  </h4>
                  <p className="text-slate-300 text-xs leading-relaxed mb-3">
                    {alert.message}
                  </p>

                  {/* Reading vs Threshold */}
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px] mb-3">
                    <div>
                      <span className="text-slate-400">Recorded: </span>
                      <strong className={isCritical ? 'text-rose-400' : 'text-amber-400'}>
                        {alert.currentValue}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Spec Envelope: </span>
                      <strong className="text-emerald-400">{alert.thresholdValue}</strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div className="text-[10px] text-slate-400">
                      {alert.capaRequired && (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> CAPA Required ({alert.capaId})
                        </span>
                      )}
                      {alert.isAcknowledged && (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged by {alert.acknowledgedBy}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenReportForAlert(alert)}
                        className="min-h-[44px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3 h-3 text-teal-400" />
                        <span>Dossier</span>
                      </button>

                      {!alert.isAcknowledged && (
                        canAcknowledge ? (
                          <button
                            onClick={() => handleAcknowledgeClick(alert.id)}
                            className="min-h-[44px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow transition-all active:scale-95"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Only Quality Lead or GDP Auditor can acknowledge alerts"
                            aria-label="Acknowledge disabled — insufficient role"
                            className="min-h-[44px] px-3 py-1 rounded-lg bg-slate-800 text-slate-500 text-[11px] font-bold flex items-center gap-1.5 cursor-not-allowed"
                          >
                            <Lock className="w-3 h-3" /> Acknowledge
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <LiveIndicator status={realtimeStatus} localLabel="Local Simulation Mode" />
          <button
            onClick={onClose}
            className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            Dismiss Panel
          </button>
        </div>

      </div>
    </div>
  );
};
