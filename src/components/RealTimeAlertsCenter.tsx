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
  Lock,
  Thermometer,
  Truck,
  CloudLightning,
  Zap,
  FileWarning
} from 'lucide-react';
import { AlertNotification, TransportLane, SupabaseUser } from '../types';
import { formatTime } from '../utils/dateFormat';
import { LiveIndicator } from './LiveIndicator';
import { useThemeTokens } from '../contexts/ViewModeContext';

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

/** Per-type icon + accent, distinct from the severity-driven card color — so a CARRIER_DISRUPTION
 *  alert reads as visually different from a TEMPERATURE_EXCURSION alert at a glance, not just by
 *  its title text, even when both happen to be Critical severity. */
const ALERT_TYPE_VISUAL: Record<AlertNotification['type'], { icon: React.ComponentType<{ className?: string }>; label: string; light: string; dark: string }> = {
  TEMPERATURE_EXCURSION: { icon: Thermometer, label: 'Temperature', light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-500/20 text-rose-300' },
  TRANSIT_DELAY: { icon: Clock, label: 'Transit Delay', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/20 text-amber-300' },
  CUSTOMS_HOLD: { icon: FileWarning, label: 'Customs', light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-500/20 text-purple-300' },
  WEATHER_DISRUPTION: { icon: CloudLightning, label: 'Weather', light: 'bg-sky-100 text-sky-700', dark: 'bg-sky-500/20 text-sky-300' },
  GDP_BREACH: { icon: ShieldAlert, label: 'GDP Breach', light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-500/20 text-orange-300' },
  SHOCK_IMPACT: { icon: Zap, label: 'Shock/Impact', light: 'bg-yellow-100 text-yellow-700', dark: 'bg-yellow-500/20 text-yellow-300' },
  CARRIER_DISRUPTION: { icon: Truck, label: 'Carrier Disruption', light: 'bg-teal-100 text-teal-700', dark: 'bg-teal-500/20 text-teal-300' },
};

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
  const t = useThemeTokens();
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
      <div className={`${t.cardBg} border-l ${t.light ? 'border-slate-300' : 'border-slate-700'} w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200`}>

        {/* Header */}
        <div className={`p-4 sm:p-5 ${t.cardBgSunken} border-b ${t.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${t.light ? 'bg-rose-100 text-rose-600 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
              <BellRing className="w-5 h-5 motion-safe:animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-bold ${t.textPrimary}`}>Real-Time Alert Center</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.light ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                  {criticalAlerts.filter(a => !a.isAcknowledged).length} Unresolved Critical
                </span>
              </div>
              <p className={`text-xs ${t.textMuted}`}>
                24/7 Automated IoT Threshold & Regulatory Deviation Trigger
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${t.chipBg} ${t.hoverBg} ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
            aria-label="Close alert center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canAcknowledge && (
          <div className={`mx-4 mt-3 p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${t.cardBgSunken} border ${t.border} ${t.textMuted}`}>
            <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${t.textFaint}`} />
            <span>Your role ({currentUserRole || 'unknown'}) can view alerts but only a Quality Lead or GDP Auditor can acknowledge them.</span>
          </div>
        )}

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {alerts.length === 0 ? (
            <div className={`text-center py-16 ${t.textMuted}`}>
              <CheckCircle2 className={`w-10 h-10 mx-auto mb-2 opacity-80 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <p className={`font-semibold ${t.textSecondary}`}>All Corridors Operating Normal</p>
              <p className={`text-[11px] mt-1 ${t.textMuted}`}>No active temperature excursions or transit alerts.</p>
            </div>
          ) : (
            sortedAlerts.map((alert) => {
              const isCritical = alert.severity === 'Critical';
              const showConfirmation = justAcknowledged.has(alert.id);
              const typeVisual = ALERT_TYPE_VISUAL[alert.type];
              const TypeIcon = typeVisual.icon;

              return (
                <div
                  key={alert.id}
                  className={`relative p-4 rounded-xl border transition-all ${
                    showConfirmation
                      ? t.light ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/30 border-emerald-700/60'
                      : alert.isAcknowledged
                      ? t.light ? 'bg-slate-100/60 border-slate-300 opacity-70' : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : isCritical
                      ? t.light ? 'bg-rose-50 border-rose-300 shadow-md' : 'bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/20'
                      : t.light ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-amber-950/30 border-amber-800/60 shadow-md shadow-amber-950/20'
                  }`}
                >
                  {showConfirmation && (
                    <div className={`absolute inset-0 rounded-xl flex items-center justify-center gap-2 font-bold text-sm z-10 ${
                      t.light ? 'bg-emerald-100/95 text-emerald-700' : 'bg-emerald-950/80 text-emerald-300'
                    }`}>
                      <CheckCircle2 className="w-5 h-5" />
                      Acknowledged
                    </div>
                  )}

                  {/* Alert Top Bar */}
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`p-1 rounded-md flex items-center gap-1 text-[10px] font-bold ${t.light ? typeVisual.light : typeVisual.dark}`}
                        title={typeVisual.label}
                      >
                        <TypeIcon className="w-3 h-3" />
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                        alert.isAcknowledged
                          ? `${t.chipBg} ${t.textMuted} ${t.light ? 'border-slate-300' : 'border-slate-700'}`
                          : isCritical
                          ? t.light ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : t.light ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {alert.severity.toUpperCase()}{alert.isAcknowledged ? ' · ACKNOWLEDGED' : ''}
                      </span>
                      <button
                        onClick={() => onSelectLaneByCode(alert.laneCode)}
                        className={`font-mono font-bold hover:underline flex items-center gap-1 ${t.light ? 'text-teal-700' : 'text-teal-300'}`}
                      >
                        {alert.laneCode} ({alert.route})
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    <span className={`text-[10px] flex items-center gap-1 ${t.textMuted}`}>
                      <Clock className="w-3 h-3" /> {formatTime(alert.timestamp)}
                    </span>
                  </div>

                  {/* Title & Message */}
                  <h4 className={`font-bold text-sm mb-1 ${t.textPrimary}`}>
                    {alert.title}
                  </h4>
                  <p className={`text-xs leading-relaxed mb-3 ${t.textSecondary}`}>
                    {alert.message}
                  </p>

                  {/* Reading vs Threshold */}
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between text-[11px] mb-3 ${t.cardBg} ${t.borderSubtle}`}>
                    <div>
                      <span className={t.textMuted}>Recorded: </span>
                      <strong className={isCritical ? (t.light ? 'text-rose-600' : 'text-rose-400') : (t.light ? 'text-amber-600' : 'text-amber-400')}>
                        {alert.currentValue}
                      </strong>
                    </div>
                    <div>
                      <span className={t.textMuted}>Spec Envelope: </span>
                      <strong className={t.light ? 'text-emerald-600' : 'text-emerald-400'}>{alert.thresholdValue}</strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={`flex items-center justify-between pt-2 border-t ${t.borderSubtle}`}>
                    <div className="text-[10px]">
                      {alert.capaRequired && (
                        <span className={`font-semibold flex items-center gap-1 ${t.light ? 'text-rose-600' : 'text-rose-400'}`}>
                          <ShieldAlert className="w-3 h-3" /> CAPA Required ({alert.capaId})
                        </span>
                      )}
                      {alert.isAcknowledged && (
                        <span className={`font-medium flex items-center gap-1 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`}>
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged by {alert.acknowledgedBy}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenReportForAlert(alert)}
                        className={`min-h-[44px] px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${t.chipBg} ${t.hoverBg} ${t.textSecondary}`}
                      >
                        <FileText className={`w-3 h-3 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
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
                            className={`min-h-[44px] px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-not-allowed ${t.chipBg} ${t.textFaint}`}
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
        <div className={`p-4 ${t.cardBgSunken} border-t ${t.border} flex items-center justify-between text-xs ${t.textMuted}`}>
          <LiveIndicator status={realtimeStatus} localLabel="Local Simulation Mode" />
          <button
            onClick={onClose}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-lg ${t.chipBg} ${t.textSecondary} ${t.light ? 'hover:text-slate-900' : 'hover:text-white'}`}
          >
            Dismiss Panel
          </button>
        </div>

      </div>
    </div>
  );
};
