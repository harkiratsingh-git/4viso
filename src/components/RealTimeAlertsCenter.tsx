import React from 'react';
import { 
  X, 
  BellRing, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Send, 
  Radio, 
  ThermometerSnowflake,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { AlertNotification, TransportLane } from '../types';

interface RealTimeAlertsCenterProps {
  alerts: AlertNotification[];
  lanes: TransportLane[];
  onClose: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onSelectLaneByCode: (laneCode: string) => void;
  onOpenReportForAlert: (alert: AlertNotification) => void;
}

export const RealTimeAlertsCenter: React.FC<RealTimeAlertsCenterProps> = ({
  alerts,
  lanes,
  onClose,
  onAcknowledgeAlert,
  onSelectLaneByCode,
  onOpenReportForAlert,
}) => {
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical');
  const warningAlerts = alerts.filter(a => a.severity === 'Warning');
  const acknowledgedAlerts = alerts.filter(a => a.isAcknowledged);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <BellRing className="w-5 h-5 animate-pulse" />
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
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {alerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-200">All Corridors Operating Normal</p>
              <p className="text-slate-400 text-[11px] mt-1">No active temperature excursions or transit alerts.</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isCritical = alert.severity === 'Critical';

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border transition-all ${
                    alert.isAcknowledged
                      ? 'bg-slate-950/50 border-slate-800 opacity-75'
                      : isCritical
                      ? 'bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/20'
                      : 'bg-amber-950/30 border-amber-800/60 shadow-md shadow-amber-950/20'
                  }`}
                >
                  {/* Alert Top Bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        isCritical ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {alert.severity.toUpperCase()}
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
                      <Clock className="w-3 h-3" /> {alert.timestamp.slice(11, 19)}
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
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3 h-3 text-teal-400" />
                        <span>Dossier</span>
                      </button>

                      {!alert.isAcknowledged && (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow transition-all active:scale-95"
                        >
                          Acknowledge
                        </button>
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
          <span>Real-time Sentinel Polling: <strong>Every 5s</strong></span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            Dismiss Panel
          </button>
        </div>

      </div>
    </div>
  );
};
