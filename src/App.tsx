import React, { useState, useEffect, useMemo } from 'react';
import { 
  INITIAL_LANES, 
  INITIAL_WEATHER_DISRUPTIONS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_ALERTS 
} from './data/mockData';
import {
  TransportLane,
  FilterState,
  AlertNotification,
  AuditLogEntry,
  RiskFactor,
  TemperatureReading,
  SystemSettings,
  SupabaseUser,
  CorridorAdvisory,
  Carrier,
  CarrierPerformanceSummary,
  WeatherDisruption
} from './types';
import { Sidebar, AppTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { KpiOverview } from './components/KpiOverview';
import { GlobalNetworkMap } from './components/GlobalNetworkMap';
import { WeatherDisruptions } from './components/WeatherDisruptions';
import { FilterToolbar } from './components/FilterToolbar';
import { LaneManagementTable } from './components/LaneManagementTable';
import { LaneRiskAssessmentModal } from './components/LaneRiskAssessmentModal';
import { ManageLaneStopsModal } from './components/ManageLaneStopsModal';
import { LiveIndicator } from './components/LiveIndicator';
import { EditLaneModal } from './components/EditLaneModal';
import { CertificationIssue } from './utils/ports';
import { isLaneExcursing, isLaneHighRisk, getEffectiveRiskLevel, getEffectiveRiskScore, deriveRiskLevelFromScore, gdpStatusForRiskLevel } from './utils/laneRisk';
import { recomputeLaneRisk, recomputeLaneRiskFromLegScores, resolutionMessage, syncRecomputedRisk, RecomputedLaneRisk } from './utils/laneRiskRecompute';
import { deriveDisruptionsFromAdvisories } from './utils/corridorAdvisories';
import { fetchWeatherHazardDisruptions } from './services/weatherService';
import { useViewMode } from './contexts/ViewModeContext';
import { SimpleDashboard } from './components/SimpleDashboard';
import { formatUtcCompact, formatUtcCompactNoSeconds } from './utils/dateFormat';
import { TemperatureMonitoringSystem } from './components/TemperatureMonitoringSystem';
import { NewLaneWizardModal } from './components/NewLaneWizardModal';
import { CommandPalette } from './components/CommandPalette';
import { ChatAssistant } from './components/ChatAssistant';
import { RealTimeAlertsCenter } from './components/RealTimeAlertsCenter';
import { GdpComplianceTrend } from './components/GdpComplianceTrend';
import { AuditTrailView } from './components/AuditTrailView';
import { AutomatedReportingModal } from './components/AutomatedReportingModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { SettingsPage, SettingsTab } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { PlanSelectionModal } from './components/PlanSelectionModal';
import { LandingPage } from './components/LandingPage';
import { getActiveUser, setActiveUser as persistActiveUser, DEFAULT_SUPABASE_USER, fetchAllFromSupabase, restoreSupabaseSession, signOutFromSupabase, fetchDashboardSummary, DashboardSummary, getSupabaseClient, searchLanesRemote, insertAuditLogEntry, syncLaneRiskToSupabase, fetchCorridorAdvisories, fetchCapaRecords, CapaRecord, fetchGdpComplianceSnapshots, GdpComplianceSnapshot, updateLaneRouteInSupabase, updateLaneStopsInSupabase, createMitigationCapa, fetchCarriers, fetchCarrierPerformanceSummary, updateUserProfile } from './services/supabaseService';
import { generateDefaultRiskFactors } from './utils/riskFactors';
import { mapRowToTemperatureReading, mapRowToAlert } from './services/supabaseMappers';
import {
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

const PAGE_NAMES: Record<AppTab, string> = {
  DASHBOARD: 'Global Dashboard',
  LANES: 'Lane Risk Management',
  COMPLIANCE: 'GDP Compliance Trends',
  AUDIT_LOGS: 'Immutable Audit Trail',
  SETTINGS: 'Settings & Integrations',
  LOGIN: 'Sign In / Personas',
};

const DEFAULT_SETTINGS: SystemSettings = {
  mktActivationEnergy: 83.144, // USP standard kJ/mol
  samplingIntervalSec: 5,
  excursionWarningMinutes: 15,
  electronicSignaturePin: '1979',
  sessionTimeoutMins: 30,
  auditLogLevel: 'ALL',
  temperatureUnit: 'C',
  alertEmail: 'quality.lead@biopharma-coldchain.com',
  alertSms: '+1 (555) 019-2834',
  webhookUrl: 'https://hooks.slack.com/services/PHARMA/ALERTS/COLDCHAIN',
  githubRepoUrl: 'https://github.com/harkiratdhanoa/pharmatrack-gdp-platform'
};

export default function App() {
  // Primary dataset states
  const [lanes, setLanes] = useState<TransportLane[]>(INITIAL_LANES);
  const [alerts, setAlerts] = useState<AlertNotification[]>(INITIAL_ALERTS);
  const [disruptions, setDisruptions] = useState(INITIAL_WEATHER_DISRUPTIONS);
  const [corridorAdvisories, setCorridorAdvisories] = useState<CorridorAdvisory[]>([]);
  const [capaRecords, setCapaRecords] = useState<CapaRecord[]>([]);
  const [gdpSnapshots, setGdpSnapshots] = useState<GdpComplianceSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Carrier directory + performance summary, fetched once and reused across every quick
  // "recommended fix" surfaced next to a flagged lane (Simple Dashboard, Lane Management table)
  // — the same recommendCarrier() engine the wizard uses, not a separate heuristic.
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrierPerformanceById, setCarrierPerformanceById] = useState<Map<string, CarrierPerformanceSummary>>(new Map());
  useEffect(() => {
    fetchCarriers().then((c) => c && setCarriers(c));
    fetchCarrierPerformanceSummary().then((rows) => {
      if (rows) setCarrierPerformanceById(new Map(rows.map((r) => [r.carrierId, r])));
    });
  }, []);

  // User identity: currentUser is always populated — either the real authenticated Supabase
  // user, or the single canonical "Demo Visitor" persona (DEFAULT_SUPABASE_USER) when not
  // authenticated. isAuthenticated is the one real signal for gating Advanced mode/cloud
  // writes — there's no second, independently-tracked "active role persona" that can drift out
  // of sync with it (that mismatch was a real identity-consistency bug: the sidebar and footer
  // used to read from two different sources and could show two different names at once).
  const [currentUser, setCurrentUser] = useState<SupabaseUser>(getActiveUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authCheckComplete, setAuthCheckComplete] = useState<boolean>(false);
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('pharmatrack_system_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [activeTab, setActiveTab] = useState<AppTab>('DASHBOARD');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // The landing page is the actual first thing a cold visitor sees — shown before either the
  // demo or a login form, since neither of those explains what this product is on its own.
  const [hasEnteredApp, setHasEnteredApp] = useState<boolean>(false);

  // Advanced mode (the Simple/Advanced dashboard toggle only — Lane Management/Compliance/Audit
  // Trail stay reachable in Local Simulation, same as before this round) requires a real
  // Supabase Auth session. pendingUnlockTarget remembers that the visitor was mid-attempt to
  // reach Advanced mode so a successful sign-in lands them there instead of just the dashboard.
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [planModalContext, setPlanModalContext] = useState<'advanced' | 'signin'>('advanced');
  const [pendingUnlockTarget, setPendingUnlockTarget] = useState<'ADVANCED_MODE' | null>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    mode: 'All',
    riskSeverity: 'All',
    gdpStatus: 'All',
    tempStatus: 'All',
    productCategory: 'All',
    carrier: 'All',
    showOnlyAlerts: false,
  });

  // Modal dialog states
  const [riskModalLane, setRiskModalLane] = useState<TransportLane | null>(null);
  const [tempModalLane, setTempModalLane] = useState<TransportLane | null>(null);
  const [manageStopsLane, setManageStopsLane] = useState<TransportLane | null>(null);
  const [editLaneLane, setEditLaneLane] = useState<TransportLane | null>(null);
  const [isNewLaneWizardOpen, setIsNewLaneWizardOpen] = useState<boolean>(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);
  const [isAlertsCenterOpen, setIsAlertsCenterOpen] = useState<boolean>(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isChatAssistantOpen, setIsChatAssistantOpen] = useState<boolean>(false);
  const [settingsFocusTab, setSettingsFocusTab] = useState<{ tab: SettingsTab } | null>(null);

  // Surfaced after a carrier/route change is saved and the lane's risk has been recomputed —
  // EditLaneModal closes itself immediately on save, so this is the only place left to show the
  // "resolved" / "transferring" confirmation for that specific path (every other recompute path
  // stays on-screen and shows its own inline message instead).
  const [riskResolutionToast, setRiskResolutionToast] = useState<string | null>(null);
  useEffect(() => {
    if (!riskResolutionToast) return;
    const timer = setTimeout(() => setRiskResolutionToast(null), 5000);
    return () => clearTimeout(timer);
  }, [riskResolutionToast]);

  // Simulation engine state
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Cloud data source state — whether the dashboard is showing live Supabase data or the local demo dataset
  const [dataSource, setDataSource] = useState<'loading' | 'cloud' | 'local'>('loading');
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'disabled' | 'connecting' | 'live' | 'reconnecting'>('disabled');
  // null = no successful remote search for the current query yet (use local filtering fallback);
  // a Set = the trigram-indexed search_lanes RPC matched these lane IDs for the current query.
  const [remoteSearchIds, setRemoteSearchIds] = useState<Set<string> | null>(null);

  const refreshDashboardSummary = () => {
    fetchDashboardSummary()
      .then(summary => setDashboardSummary(summary))
      .catch(err => console.warn('Failed to refresh dashboard_summary:', err));
  };

  // dashboard_summary (and anything else reading risk_level directly) can only ever agree
  // with the Lane table if transport_lanes.risk_score/risk_level actually reflect live state —
  // they're stored columns set at creation time, never updated by the temperature simulation
  // itself. Correct any lane whose stored risk disagrees with the live-computed effective risk
  // (utils/laneRisk.ts), then refresh the summary so the dashboard cards pick up the fix.
  const reconcileLaneRiskWithSupabase = async (lanesToCheck: TransportLane[]) => {
    const stale = lanesToCheck.filter(
      (l) => getEffectiveRiskScore(l) !== l.riskScore || getEffectiveRiskLevel(l) !== l.riskLevel
    );
    if (stale.length === 0) return;
    await Promise.all(stale.map((l) => syncLaneRiskToSupabase(l.id, getEffectiveRiskScore(l), getEffectiveRiskLevel(l))));
    refreshDashboardSummary();
  };

  // On mount, attempt to load real data from the connected Supabase project.
  // Falls back to the local demo dataset (already the initial state above) if unavailable.
  useEffect(() => {
    let cancelled = false;

    fetchAllFromSupabase()
      .then(result => {
        if (cancelled) return;
        if (result && result.lanes.length > 0) {
          setLanes(result.lanes);
          setAlerts(result.alerts);
          if (result.auditLogs.length > 0) setAuditLogs(result.auditLogs);
          setDataSource('cloud');
          refreshDashboardSummary();
          reconcileLaneRiskWithSupabase(result.lanes);
          fetchCorridorAdvisories().then((a) => a && setCorridorAdvisories(a));
          fetchCapaRecords().then((c) => c && setCapaRecords(c));
          fetchGdpComplianceSnapshots().then((s) => s && setGdpSnapshots(s));
        } else {
          setDataSource('local');
        }
      })
      .catch(err => {
        console.warn('Failed to load data from Supabase, using local demo dataset:', err);
        if (!cancelled) setDataSource('local');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Restore a real, verified Supabase Auth session on load (if one exists), overriding the
  // local demo persona default set above.
  useEffect(() => {
    let cancelled = false;

    restoreSupabaseSession()
      .then(user => {
        if (cancelled || !user) return;
        setCurrentUser(user);
        persistActiveUser(user);
        setIsAuthenticated(true);
      })
      .catch(err => console.warn('Failed to restore Supabase session:', err))
      .finally(() => {
        if (!cancelled) setAuthCheckComplete(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);


  // Periodic IoT telemetry background simulation ticker — local demo mode only. When
  // connected to Supabase, real Realtime events (below) drive updates instead.
  useEffect(() => {
    if (!isSimulating || dataSource === 'cloud') return;

    const interval = setInterval(() => {
      setLanes(prevLanes => {
        return prevLanes.map(lane => {
          // Slight fluctuation in temp (±0.1°C)
          const delta = (Math.random() * 0.2 - 0.1);
          const newTemp = Number((lane.currentTemp + delta).toFixed(1));
          const isExcursion = newTemp > lane.tempMax || newTemp < lane.tempMin;

          const latestReading = lane.temperatureHistory[lane.temperatureHistory.length - 1];
          const newReading: TemperatureReading = {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            coreTemp: newTemp,
            ambientTemp: Number(((latestReading?.ambientTemp || 22) + delta * 2).toFixed(1)),
            surfaceTemp: Number((newTemp + 0.2).toFixed(1)),
            minPermitted: lane.tempMin,
            maxPermitted: lane.tempMax,
            humidity: latestReading?.humidity || 45,
            batteryLevel: Math.max(15, (latestReading?.batteryLevel || 95) - (Math.random() > 0.8 ? 1 : 0)),
            shockG: Number((0.1 + Math.random() * 0.2).toFixed(1)),
            isExcursion,
          };

          return {
            ...lane,
            currentTemp: newTemp,
            transitProgress: Math.min(100, lane.transitProgress + (Math.random() > 0.6 ? 1 : 0)),
            temperatureHistory: [...lane.temperatureHistory.slice(-9), newReading],
          };
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isSimulating, dataSource]);

  // Real-time telemetry & alert updates via Supabase Realtime — replaces polling entirely
  // when cloud-connected. realtimeStatus drives the Live/Reconnecting indicator in the footer.
  useEffect(() => {
    if (dataSource !== 'cloud') {
      setRealtimeStatus('disabled');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setRealtimeStatus('disabled');
      return;
    }

    setRealtimeStatus('connecting');

    const channel = client
      .channel('pharmatrack-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'temperature_telemetry' }, (payload) => {
        const reading = mapRowToTemperatureReading(payload.new);
        const laneId = String((payload.new as any).lane_id);
        let updatedLane: TransportLane | null = null;
        setLanes(prev => prev.map(l => {
          if (l.id !== laneId) return l;
          updatedLane = { ...l, currentTemp: reading.coreTemp, temperatureHistory: [...l.temperatureHistory.slice(-9), reading] };
          return updatedLane;
        }));
        refreshDashboardSummary();
        if (updatedLane) reconcileLaneRiskWithSupabase([updatedLane]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alert_notifications' }, (payload) => {
        const alert = mapRowToAlert(payload.new);
        setAlerts(prev => (prev.some(a => a.id === alert.id) ? prev : [alert, ...prev]));
        refreshDashboardSummary();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alert_notifications' }, (payload) => {
        const alert = mapRowToAlert(payload.new);
        setAlerts(prev => prev.map(a => (a.id === alert.id ? alert : a)));
        refreshDashboardSummary();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('reconnecting');
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [dataSource]);

  // Debounced server-side trigram search (idx_lanes_search_trgm / search_lanes RPC) when
  // cloud-connected — falls back to local multi-field filtering below on failure or when
  // running against the local demo dataset.
  useEffect(() => {
    const query = filters.searchQuery.trim();
    if (dataSource !== 'cloud' || query === '') {
      setRemoteSearchIds(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      searchLanesRemote(query).then(results => {
        if (cancelled) return;
        setRemoteSearchIds(results ? new Set(results.map(l => l.id)) : null);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [filters.searchQuery, dataSource]);

  // Cmd/Ctrl+K opens the command palette from anywhere in the app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Log an event into immutable audit trail
  const appendAuditLog = (
    laneCode: string,
    action: string,
    category: AuditLogEntry['category'],
    details: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: formatUtcCompact(new Date()),
      actor: currentUser.name,
      role: currentUser.role,
      laneCode,
      action,
      category,
      details,
      hash: '0x' + Math.random().toString(16).substring(2, 18),
      status: 'VERIFIED',
    };
    setAuditLogs(prev => [newLog, ...prev]);
    // Write live too, not just local state — a GDP audit trail that only exists in memory
    // until the next manual "sync to cloud" click isn't a real audit trail. Fire-and-forget:
    // this must never block or fail the action it's recording.
    if (dataSource === 'cloud') {
      insertAuditLogEntry(newLog).catch(() => {});
    }
  };

  // Update Settings handler
  const handleUpdateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('pharmatrack_system_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
    appendAuditLog('SYSTEM', 'Updated System Settings', 'SECURITY', `Updated MKT activation energy to ${newSettings.mktActivationEnergy} kJ/mol, sampling rate ${newSettings.samplingIntervalSec}s.`);
  };

  // Update User handler
  const handleUpdateUser = (updatedUser: SupabaseUser) => {
    setCurrentUser(updatedUser);
    persistActiveUser(updatedUser);
    appendAuditLog('AUTH', 'Updated Signatory Profile', 'SECURITY', `Signatory updated to ${updatedUser.name} (${updatedUser.role}).`);
    // Fire-and-forget, matching every other cloud-only write in this app — name/organization
    // edits previously only ever touched local React state, so they silently reverted on
    // reload for a real cloud-connected user despite the audit trail claiming they were saved.
    if (dataSource === 'cloud' && isAuthenticated) {
      updateUserProfile(updatedUser.id, { fullName: updatedUser.name, organization: updatedUser.organization }).catch(() => {});
    }
  };

  // Login Success handler
  const handleLoginSuccess = (user: SupabaseUser) => {
    setCurrentUser(user);
    persistActiveUser(user);
    setIsAuthenticated(true);
    if (pendingUnlockTarget === 'ADVANCED_MODE') {
      setViewMode('advanced');
      setPendingUnlockTarget(null);
    } else {
      setActiveTab('DASHBOARD');
    }
    appendAuditLog('AUTH', 'User Authentication Success', 'SECURITY', `User authenticated as ${user.name} (${user.role}) via ${user.authProvider || 'Email/Password'}.`);
  };

  // Sign out current user and return to Simple mode, unauthenticated — Advanced mode requires a
  // real session, so signing out must drop back out of it, not leave it visibly unlocked.
  const handleLogout = () => {
    appendAuditLog('AUTH', 'User Signed Out', 'SECURITY', `${currentUser.name} ended their authenticated session.`);
    signOutFromSupabase().catch(() => {});
    persistActiveUser(DEFAULT_SUPABASE_USER);
    setCurrentUser(DEFAULT_SUPABASE_USER);
    setIsAuthenticated(false);
    setViewMode('simple');
    setActiveTab('DASHBOARD');
  };

  // The gate for Advanced mode specifically (the Simple/Advanced dashboard toggle) — a real
  // Supabase session unlocks it directly, otherwise the plan-selection modal (not a real payment
  // flow) leads into real sign-up/sign-in first. Lane Risk Management / Compliance / Audit Trail
  // are NOT gated by this — those pages stay reachable in Local Simulation same as before, and
  // gating them broke the demo-mode carrier-edit flow, so don't reintroduce that here.
  const requestAdvancedAccess = (target: 'ADVANCED_MODE') => {
    if (isAuthenticated) {
      setViewMode('advanced');
      return;
    }
    setPendingUnlockTarget(target);
    setPlanModalContext('advanced');
    setShowPlanModal(true);
  };

  const handleSwitchTab = (tab: AppTab) => {
    setActiveTab(tab);
  };

  // Add new lane handler
  const handleCreateLane = (newLane: TransportLane) => {
    setLanes(prev => [newLane, ...prev]);
    appendAuditLog(
      newLane.laneCode,
      'New Transport Lane Provisioned',
      'LANE_CONFIGURATION',
      `Provisioned ${newLane.mode} lane ${newLane.laneCode} with threshold alert boundaries (${newLane.tempMin}°C - ${newLane.tempMax}°C).`
    );
  };

  // A lane created via the chat assistant is inserted directly into Supabase by the Edge
  // Function, bypassing local state entirely — refetch before trying to open it.
  const handleLaneCreatedViaChat = (laneCode: string) => {
    fetchAllFromSupabase().then((result) => {
      if (!result) return;
      setLanes(result.lanes);
      setAlerts(result.alerts);
      refreshDashboardSummary();
      const found = result.lanes.find((l) => l.laneCode === laneCode);
      if (found) {
        setRiskModalLane(found);
        setIsChatAssistantOpen(false);
      }
    });
  };

  // Add custom risk factor to lane
  const handleAddRiskFactor = (laneId: string, newRisk: RiskFactor) => {
    setLanes(prev => prev.map(l => {
      if (l.id === laneId) {
        const updatedRisks = [newRisk, ...l.risks];
        const newRiskScore = Math.min(99, Math.round(l.riskScore + newRisk.score * 0.2));
        return {
          ...l,
          risks: updatedRisks,
          riskScore: newRiskScore,
          riskLevel: newRiskScore >= 50 ? 'Critical' : newRiskScore >= 35 ? 'High' : newRiskScore >= 20 ? 'Medium' : 'Low',
        };
      }
      return l;
    }));

    const targetLane = lanes.find(l => l.id === laneId);
    if (targetLane) {
      appendAuditLog(
        targetLane.laneCode,
        `Risk Factor Logged: ${newRisk.title}`,
        'RISK_OVERRIDE',
        `Logged risk under ${newRisk.category} with severity ${newRisk.severity}.`
      );
    }
  };

  // Risk factors are never persisted server-side (see generateDefaultRiskFactors) — a lane
  // fetched from Supabase arrives with risks: [] since there's no lane_risk_factors table, which
  // otherwise left the Risk Assessment modal permanently empty for every real cloud lane. Called
  // once by the modal when it opens a lane with no risks yet; a no-op if risks already exist
  // (guards against a stale hydration racing a real update).
  const handleHydrateRiskFactors = (laneId: string, risks: RiskFactor[]) => {
    setLanes(prev => prev.map(l => (l.id === laneId && l.risks.length === 0 ? { ...l, risks } : l)));
  };

  // "Execute Mitigation" on a risk factor — the fixed dead-button bug. Always updates the risk's
  // visible status and logs the action; Regulatory & GDP items additionally open a real CAPA
  // (cloud: capa_records: local: an equivalent locally-synthesized record, so the flow is
  // identical either way, just not durably saved outside cloud).
  // Mirrors handleAddRiskFactor's inverse: that handler bumps riskScore up by score*0.2 when a
  // new risk is logged, so actioning one brings it back down by the same amount — the lane's
  // stored composite risk actually moves when a risk factor is mitigated, instead of only the
  // risk factor's own status changing while the lane sits at whatever score it had before.
  const handleExecuteMitigation = (laneId: string, risk: RiskFactor): RecomputedLaneRisk | null => {
    const targetLane = lanes.find(l => l.id === laneId);
    if (!targetLane) return null;

    const newScore = Math.max(0, Math.round(targetLane.riskScore - risk.score * 0.2));
    const newLevel = deriveRiskLevelFromScore(newScore);
    const recomputed: RecomputedLaneRisk = { riskScore: newScore, riskLevel: newLevel, gdpStatus: gdpStatusForRiskLevel(newLevel) };

    setLanes(prev => prev.map(l => (
      l.id === laneId
        ? { ...l, risks: l.risks.map(r => (r.id === risk.id ? { ...r, status: 'Mitigation Actioned' as const } : r)), ...recomputed }
        : l
    )));
    syncRecomputedRisk(laneId, recomputed, dataSource);

    const laneCode = targetLane.laneCode;
    appendAuditLog(
      laneCode,
      `Mitigation Executed: ${risk.title}`,
      'MITIGATION_EXECUTED',
      `${risk.mitigationStrategy} Risk re-assessed at ${recomputed.riskScore}% (${recomputed.riskLevel}).`
    );

    if (risk.category !== 'Regulatory & GDP') return recomputed;

    if (dataSource === 'cloud') {
      createMitigationCapa({
        laneId,
        laneCode,
        route: `${targetLane.originCity} → ${targetLane.destinationCity}`,
        riskTitle: risk.title,
        riskDescription: risk.description,
        mitigationStrategy: risk.mitigationStrategy,
        severity: risk.severity,
      }).catch(() => {});
    } else {
      // Local/demo equivalent — same shape as a real CapaRecord, added straight to the same
      // capaRecords state the cloud fetch populates, so GDP Compliance Trend's "Open CAPAs"
      // count and the Reporting modal's CAPA list reflect it identically either way.
      const capaId = `CAPA-${new Date().getFullYear()}-M${Date.now().toString().slice(-6)}`;
      setCapaRecords(prev => [
        {
          id: capaId,
          capaNumber: capaId,
          alertId: `local-${Date.now()}`,
          laneCode,
          title: risk.title,
          description: risk.description,
          rootCause: '',
          correctiveAction: risk.mitigationStrategy,
          preventiveAction: '',
          owner: 'Unassigned',
          status: 'Open',
          priority: risk.severity,
          dueDate: null,
          closedDate: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    return recomputed;
  };

  // Part 1: shared sink for the per-leg carrier assignment panel and the Phase 4 disruption
  // panel, both of which recompute the lane's real composite risk themselves (they have the
  // per-leg risk scores in hand already) and just need it written into lanes state + synced.
  const handleLaneRiskUpdated = (laneId: string, risk: RecomputedLaneRisk) => {
    setLanes(prev => prev.map(l => (l.id === laneId ? { ...l, ...risk } : l)));
    syncRecomputedRisk(laneId, risk, dataSource);
  };

  // Update a lane's intermediate stops from the Manage Route page
  const handleUpdateLaneStops = (laneId: string, stops: TransportLane['stops']) => {
    setLanes(prev => prev.map(l => (l.id === laneId ? { ...l, stops } : l)));

    const targetLane = lanes.find(l => l.id === laneId);
    if (targetLane) {
      appendAuditLog(
        targetLane.laneCode,
        'Route Stops Updated',
        'LANE_CONFIGURATION',
        `Route for ${targetLane.laneCode} now has ${stops.length} intermediate stop${stops.length === 1 ? '' : 's'}.`
      );
    }

    // Fire-and-forget, matching every other cloud-only write in this app — a demo/local lane's
    // id doesn't exist as a transport_lanes row, so this must never be attempted outside cloud.
    if (dataSource === 'cloud') {
      updateLaneStopsInSupabase(laneId, stops).catch(() => {});
    }
  };

  // Full lane edit (emergency reroute, carrier/cargo change, etc.) from the Edit Lane page.
  // Recomputes the lane's real composite risk against the *new* route/mode/temp range (Part 1)
  // rather than leaving risk_score/risk_level/gdp_status as whatever they were before the edit —
  // async because that recompute may call the live calculate_lane_base_risk RPC.
  const handleUpdateLane = async (
    laneId: string,
    updates: Parameters<React.ComponentProps<typeof EditLaneModal>['onSave']>[1],
    certificationIssues: CertificationIssue[]
  ) => {
    const targetLane = lanes.find(l => l.id === laneId);
    const laneCode = targetLane?.laneCode || updates.originIata + '-' + updates.destinationIata;
    const previousLevel = targetLane ? getEffectiveRiskLevel(targetLane) : 'Low';

    const risk = await recomputeLaneRisk({
      originIata: updates.originIata,
      originCoords: updates.originCoords,
      destinationIata: updates.destinationIata,
      destinationCoords: updates.destinationCoords,
      stops: updates.stops,
      mode: updates.mode,
      tempRangeType: updates.tempRangeType,
      tempMin: updates.tempMin,
      tempMax: updates.tempMax,
      dataSource,
    });

    setLanes(prev => prev.map(l => (l.id === laneId ? { ...l, ...updates, ...risk } : l)));
    setRiskResolutionToast(resolutionMessage(previousLevel, risk, updates.carrier));

    appendAuditLog(
      laneCode,
      'Lane Rerouted / Updated',
      'LANE_CONFIGURATION',
      `Route updated to ${updates.originIata} → ${updates.stops.map(s => s.iata).join(' → ')}${updates.stops.length ? ' → ' : ''}${updates.destinationIata} via ${updates.mode} (${updates.carrier}). Risk re-assessed at ${risk.riskScore}% (${risk.riskLevel}).`
    );

    // Fire-and-forget, matching every other cloud-only write in this app — a demo/local lane's
    // id doesn't exist as a transport_lanes row, so this must never be attempted outside cloud.
    if (dataSource === 'cloud') {
      updateLaneRouteInSupabase(laneId, updates).catch(() => {});
      syncRecomputedRisk(laneId, risk, dataSource);
    }

    if (certificationIssues.length > 0 && targetLane) {
      const newAlert: AlertNotification = {
        id: `alt-${Date.now()}`,
        laneId,
        laneCode,
        route: `${updates.originCity} → ${updates.destinationCity}`,
        timestamp: formatUtcCompact(new Date()),
        type: 'GDP_BREACH',
        severity: 'Warning',
        title: `Route Certification Gap in ${laneCode}`,
        message: certificationIssues.map(i => i.issue).join(' '),
        currentValue: `${certificationIssues.length} issue${certificationIssues.length > 1 ? 's' : ''}`,
        thresholdValue: 'GDP certification + cold storage required',
        isAcknowledged: false,
        capaRequired: true,
        capaId: `CAPA-2026-${Math.floor(100 + Math.random() * 899)}`,
      };
      setAlerts(prev => [newAlert, ...prev]);
      appendAuditLog(
        laneCode,
        'Route Certification Alert Raised',
        'GDP_AUDIT',
        certificationIssues.map(i => i.issue).join(' ')
      );
    }
  };

  // Update lane temperature (e.g. from telemetry controller)
  const handleUpdateLaneTemp = (laneId: string, newTemp: number, isExcursion: boolean) => {
    setLanes(prev => prev.map(l => {
      if (l.id === laneId) {
        return {
          ...l,
          currentTemp: newTemp,
          status: isExcursion ? 'Temperature Alert' : l.status === 'Temperature Alert' ? 'In Transit' : l.status,
        };
      }
      return l;
    }));

    const targetLane = lanes.find(l => l.id === laneId);
    if (targetLane) {
      appendAuditLog(
        targetLane.laneCode,
        'Reefer Telemetry & Thermal Calibration Updated',
        'TEMPERATURE_MONITORING',
        `Core temperature setpoint adjusted to ${newTemp}°C. Excursion status: ${isExcursion ? 'TRIGGERED' : 'NORMAL'}`
      );
    }
  };

  // Acknowledge alert
  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          isAcknowledged: true,
          acknowledgedBy: currentUser.name,
          acknowledgedAt: formatUtcCompactNoSeconds(new Date()),
        };
      }
      return a;
    }));

    const foundAlert = alerts.find(a => a.id === alertId);
    if (foundAlert) {
      appendAuditLog(
        foundAlert.laneCode,
        `Alert Acknowledged: ${foundAlert.title}`,
        'ALERT_ACKNOWLEDGED',
        `Formally acknowledged by ${currentUser.name} (${currentUser.role}).`
      );
    }
  };

  // Trigger simulated excursion
  const handleTriggerSimulatedExcursion = () => {
    const targetLane = lanes.find(l => l.status !== 'Temperature Alert') || lanes[0];
    if (!targetLane) return;

    const excursionTemp = Number((targetLane.tempMax + 3.2).toFixed(1));
    handleUpdateLaneTemp(targetLane.id, excursionTemp, true);

    const newAlert: AlertNotification = {
      id: `alt-${Date.now()}`,
      laneId: targetLane.id,
      laneCode: targetLane.laneCode,
      route: `${targetLane.originCity} → ${targetLane.destinationCity}`,
      timestamp: formatUtcCompact(new Date()),
      type: 'TEMPERATURE_EXCURSION',
      severity: 'Critical',
      title: `Simulated Excursion in ${targetLane.laneCode}`,
      message: `Payload temperature spiked to ${excursionTemp}°C, breaching ${targetLane.tempMax}°C limit. Rapid re-icing required.`,
      currentValue: `${excursionTemp}°C`,
      thresholdValue: `${targetLane.tempMin}°C – ${targetLane.tempMax}°C`,
      isAcknowledged: false,
      capaRequired: true,
      capaId: `CAPA-2026-${Math.floor(100 + Math.random() * 899)}`,
    };

    setAlerts(prev => [newAlert, ...prev]);
    setIsAlertsCenterOpen(true);
  };

  // Reset to initial mock dataset
  const handleResetData = () => {
    setLanes(INITIAL_LANES);
    setAlerts(INITIAL_ALERTS);
    setDisruptions(INITIAL_WEATHER_DISRUPTIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setFilters({
      searchQuery: '',
      mode: 'All',
      riskSeverity: 'All',
      gdpStatus: 'All',
      tempStatus: 'All',
      productCategory: 'All',
      carrier: 'All',
      showOnlyAlerts: false,
    });
  };

  // Real weather-triggered disruptions (alert_type WEATHER_HAZARD, written by the weather-sync
  // Edge Function against real OpenWeatherMap readings) — cloud-only, same reasoning as the
  // corridor-advisory feed below.
  const [weatherHazardDisruptions, setWeatherHazardDisruptions] = useState<WeatherDisruption[]>([]);
  useEffect(() => {
    if (dataSource !== 'cloud') {
      setWeatherHazardDisruptions([]);
      return;
    }
    let cancelled = false;
    const load = () => fetchWeatherHazardDisruptions().then((rows) => { if (!cancelled) setWeatherHazardDisruptions(rows); });
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [dataSource]);

  // Real disruption feed: only shown when cloud-connected, since it's derived from live
  // corridor_advisories against live lanes — in local demo mode there's no live advisory feed
  // to check against, so it falls back to the local mock dataset (same fictional universe as
  // the local demo lanes, not mixed with real data).
  const effectiveDisruptions = useMemo(
    () =>
      dataSource === 'cloud'
        ? [...deriveDisruptionsFromAdvisories(lanes, corridorAdvisories), ...weatherHazardDisruptions]
        : disruptions,
    [dataSource, lanes, corridorAdvisories, disruptions, weatherHazardDisruptions]
  );

  // Filter application
  const filteredLanes = lanes.filter(lane => {
    if (filters.searchQuery.trim() !== '') {
      if (remoteSearchIds !== null) {
        if (!remoteSearchIds.has(lane.id)) return false;
      } else {
        const q = filters.searchQuery.toLowerCase();
        const match =
          lane.laneCode.toLowerCase().includes(q) ||
          lane.originCity.toLowerCase().includes(q) ||
          lane.originIata.toLowerCase().includes(q) ||
          lane.destinationCity.toLowerCase().includes(q) ||
          lane.destinationIata.toLowerCase().includes(q) ||
          lane.carrier.toLowerCase().includes(q) ||
          lane.productName.toLowerCase().includes(q);
        if (!match) return false;
      }
    }

    if (filters.mode !== 'All' && lane.mode !== filters.mode) return false;

    if (filters.riskSeverity !== 'All' && getEffectiveRiskLevel(lane) !== filters.riskSeverity) return false;

    if (filters.gdpStatus !== 'All' && lane.gdpStatus !== filters.gdpStatus) return false;

    if (filters.tempStatus === 'Compliant' && (lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin)) return false;
    if (filters.tempStatus === 'Warning' && (lane.currentTemp < lane.tempMax - 0.8 && lane.currentTemp > lane.tempMin + 0.8)) return false;
    if (filters.tempStatus === 'Excursion' && !(lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin)) return false;

    if (filters.productCategory !== 'All' && lane.productCategory !== filters.productCategory) return false;

    if (filters.showOnlyAlerts && !isLaneExcursing(lane) && !isLaneHighRisk(lane)) return false;

    return true;
  });

  const unreadAlerts = alerts.filter(a => !a.isAcknowledged);

  const criticalCount = unreadAlerts.filter(a => a.severity === 'Critical').length;

  const { mode: viewMode, setMode: setViewMode, theme } = useViewMode();
  // Light theme now applies everywhere — every component that used to be hardcoded dark reads
  // theme directly (see useThemeTokens). Simple/Advanced and light/dark are fully independent.
  const lightShell = theme === 'light';
  // `mode` persists in localStorage, so a previously-Advanced session reloading while genuinely
  // logged out would otherwise render Advanced dashboard content directly on mount, bypassing
  // requestAdvancedAccess entirely (that gate only intercepts new attempts to switch mode, not
  // a value already restored from storage). Every render of Advanced-mode-gated content reads
  // this instead of the raw context value.
  const effectiveViewMode = isAuthenticated ? viewMode : 'simple';

  // `mode` persists in localStorage independently of auth state, so a browser that previously
  // had Advanced mode selected would otherwise keep showing the TopBar's Advanced button as
  // active — disagreeing with `effectiveViewMode` above, which forces Simple content once we
  // know for certain (after the async session-restore check settles) that this load is
  // genuinely logged out. Correcting the underlying `mode` value here, once, keeps every reader
  // of `viewMode` (including TopBar's own separate context read) in agreement.
  useEffect(() => {
    if (authCheckComplete && !isAuthenticated && viewMode === 'advanced') {
      setViewMode('simple');
    }
  }, [authCheckComplete, isAuthenticated, viewMode, setViewMode]);

  if (!hasEnteredApp) {
    return (
      <LandingPage
        lanes={lanes}
        dataSource={dataSource}
        onTryDemo={() => setHasEnteredApp(true)}
        onSignIn={() => {
          setHasEnteredApp(true);
          setPlanModalContext('signin');
          setShowPlanModal(true);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-teal-500 selection:text-white flex ${lightShell ? 'bg-slate-50 text-slate-900' : 'bg-[#070d14] text-slate-100'}`}>

      {/* Persistent Left Sidebar (desktop) */}
      <Sidebar
        activeTab={activeTab}
        onSwitchTab={handleSwitchTab}
        onOpenNewLane={() => setIsNewLaneWizardOpen(true)}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenAssistant={() => setIsChatAssistantOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsMobileNavOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar
              activeTab={activeTab}
              onSwitchTab={(tab) => {
                handleSwitchTab(tab);
                setIsMobileNavOpen(false);
              }}
              onOpenNewLane={() => {
                setIsNewLaneWizardOpen(true);
                setIsMobileNavOpen(false);
              }}
              onOpenReports={() => {
                setIsReportsModalOpen(true);
                setIsMobileNavOpen(false);
              }}
              onOpenCloudSync={() => {
                setIsCloudSyncOpen(true);
                setIsMobileNavOpen(false);
              }}
              onOpenAssistant={() => {
                setIsChatAssistantOpen(true);
                setIsMobileNavOpen(false);
              }}
              onLogout={handleLogout}
              currentUser={currentUser}
              isAuthenticated={isAuthenticated}
              className="flex flex-col h-full"
            />
          </div>
        </div>
      )}

      {/* Right Column: Top Bar + Page Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          pageName={PAGE_NAMES[activeTab]}
          searchQuery={filters.searchQuery}
          onSearchChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          unreadAlerts={unreadAlerts}
          onOpenAlerts={() => setIsAlertsCenterOpen(true)}
          realtimeStatus={realtimeStatus}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          isAuthenticated={isAuthenticated}
          onRequireAdvancedAuth={() => requestAdvancedAccess('ADVANCED_MODE')}
        />

        {/* Risk resolution toast — the one confirmation surface left after a carrier/route edit,
            since EditLaneModal closes itself immediately on save. Distinct styling for an actual
            resolution vs. a plain "change applied" transfer, per Part 1's resolved/transferring
            split. */}
        {riskResolutionToast && (
          <div className={`fixed top-4 right-4 z-[70] max-w-sm px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold animate-in slide-in-from-top-2 flex items-start gap-2 ${
            riskResolutionToast.startsWith('Resolved')
              ? lightShell ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : lightShell ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-teal-950/90 border-teal-500/50 text-teal-200'
          }`}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{riskResolutionToast}</span>
          </div>
        )}

        {/* Main Container */}
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 py-5 max-w-[1600px]">

          {/* Unresolved Critical Excursion Banner — content-level, not permanent chrome */}
          {criticalCount > 0 && (
            <button
              onClick={() => setIsAlertsCenterOpen(true)}
              className={`mb-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold motion-safe:animate-pulse whitespace-nowrap transition-all ${
                lightShell
                  ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${lightShell ? 'text-rose-600' : 'text-rose-400'}`} />
              <span>{criticalCount} Critical Excursion{criticalCount > 1 ? 's' : ''} Active</span>
            </button>
          )}

        {/* TAB 1: Global Dashboard Overview */}
        {activeTab === 'DASHBOARD' && effectiveViewMode === 'simple' && (
          <SimpleDashboard
            lanes={lanes}
            selectedLaneId={riskModalLane?.id || null}
            onSelectLane={(lane) => setRiskModalLane(lane)}
            onGoAdvanced={() => requestAdvancedAccess('ADVANCED_MODE')}
            carriers={carriers}
            carrierPerformanceById={carrierPerformanceById}
          />
        )}

        {activeTab === 'DASHBOARD' && effectiveViewMode === 'advanced' && (
          <div>
            {/* Narrow KPI column (ordered by importance) + large map, side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 mb-6 items-start">
              <div className="lg:sticky lg:top-20">
                <KpiOverview
                  lanes={lanes}
                  summary={dataSource === 'cloud' ? dashboardSummary : null}
                  onSelectFilter={(key, value) => {
                    setFilters(prev => ({ ...prev, [key]: value }));
                    setActiveTab('LANES');
                  }}
                />
              </div>

              <GlobalNetworkMap
                lanes={lanes}
                selectedLaneId={riskModalLane?.id || null}
                onSelectLane={(lane) => setRiskModalLane(lane)}
              />
            </div>

            {/* Weather & Route Disruption Alerts Feed */}
            <WeatherDisruptions
              disruptions={effectiveDisruptions}
              selectedLaneCode={riskModalLane?.laneCode || null}
              onFilterByLaneCode={(code) => {
                setFilters(prev => ({ ...prev, searchQuery: code }));
                setActiveTab('LANES');
              }}
            />

            {/* Customizable Filter Toolbar */}
            <FilterToolbar
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={() => setFilters({
                searchQuery: '',
                mode: 'All',
                riskSeverity: 'All',
                gdpStatus: 'All',
                tempStatus: 'All',
                productCategory: 'All',
                carrier: 'All',
                showOnlyAlerts: false,
              })}
            />

            {/* Lane Management Table */}
            <LaneManagementTable
              lanes={filteredLanes}
              selectedLaneId={riskModalLane?.id || null}
              onSelectLane={(lane) => setRiskModalLane(lane)}
              onOpenTempMonitor={(lane) => setTempModalLane(lane)}
              onOpenNewLaneWizard={() => setIsNewLaneWizardOpen(true)}
              onManageStops={(lane) => setManageStopsLane(lane)}
              onEditLane={(lane) => setEditLaneLane(lane)}
              carriers={carriers}
              carrierPerformanceById={carrierPerformanceById}
            />
          </div>
        )}

        {/* TAB 2: Lane Management & Risk Assessment View */}
        {activeTab === 'LANES' && (
          <div>
            <FilterToolbar
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={() => setFilters({
                searchQuery: '',
                mode: 'All',
                riskSeverity: 'All',
                gdpStatus: 'All',
                tempStatus: 'All',
                productCategory: 'All',
                carrier: 'All',
                showOnlyAlerts: false,
              })}
            />

            <LaneManagementTable
              lanes={filteredLanes}
              selectedLaneId={riskModalLane?.id || null}
              onSelectLane={(lane) => setRiskModalLane(lane)}
              onOpenTempMonitor={(lane) => setTempModalLane(lane)}
              onOpenNewLaneWizard={() => setIsNewLaneWizardOpen(true)}
              onManageStops={(lane) => setManageStopsLane(lane)}
              onEditLane={(lane) => setEditLaneLane(lane)}
              carriers={carriers}
              carrierPerformanceById={carrierPerformanceById}
            />
          </div>
        )}

        {/* TAB 3: GDP Compliance & Audit Trends */}
        {activeTab === 'COMPLIANCE' && (
          <div>
            <GdpComplianceTrend
              onOpenAuditReport={() => setIsReportsModalOpen(true)}
              snapshots={dataSource === 'cloud' ? gdpSnapshots : null}
              capaRecords={capaRecords}
            />
            <AuditTrailView logs={auditLogs} />
          </div>
        )}

        {/* TAB 4: Immutable Audit Trail */}
        {activeTab === 'AUDIT_LOGS' && (
          <div>
            <AuditTrailView logs={auditLogs} />
          </div>
        )}

        {/* TAB 5: Settings & Integration Hub */}
        {activeTab === 'SETTINGS' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            lanes={lanes}
            alerts={alerts}
            auditLogs={auditLogs}
            onResetData={handleResetData}
            onOpenLogin={() => setActiveTab('LOGIN')}
            isSimulating={isSimulating}
            onToggleSimulation={() => setIsSimulating(!isSimulating)}
            onTriggerSimulatedExcursion={handleTriggerSimulatedExcursion}
            isAuthenticated={isAuthenticated}
            dataSource={dataSource}
            focusTab={settingsFocusTab}
          />
        )}

        {/* TAB 6: Sign In / Register */}
        {activeTab === 'LOGIN' && (
          <div className="py-4">
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              currentUser={currentUser}
              onCancel={() => {
                setPendingUnlockTarget(null);
                setActiveTab('DASHBOARD');
              }}
            />
          </div>
        )}

      </main>

      {/* Advanced-mode plan-selection gate — shown when a logged-out visitor tries to switch
          from Simple to Advanced dashboard mode. */}
      {showPlanModal && (
        <PlanSelectionModal
          context={planModalContext}
          onClose={() => {
            setShowPlanModal(false);
            setPendingUnlockTarget(null);
          }}
          onContinue={() => {
            setShowPlanModal(false);
            setActiveTab('LOGIN');
          }}
        />
      )}

      {/* MODAL 1: Lane Risk Assessment & Risk Factor Selection Window */}
      {riskModalLane && (
        <LaneRiskAssessmentModal
          lane={lanes.find(l => l.id === riskModalLane.id) || riskModalLane}
          dataSource={dataSource}
          onClose={() => setRiskModalLane(null)}
          onOpenTempMonitor={(l) => {
            setRiskModalLane(null);
            setTempModalLane(l);
          }}
          onManageStops={(l) => {
            setRiskModalLane(null);
            setManageStopsLane(l);
          }}
          onEditLane={(l) => {
            setRiskModalLane(null);
            setEditLaneLane(l);
          }}
          onAddRiskFactor={handleAddRiskFactor}
          onExecuteMitigation={handleExecuteMitigation}
          onHydrateRiskFactors={handleHydrateRiskFactors}
          onLaneRiskUpdated={handleLaneRiskUpdated}
        />
      )}

      {/* MODAL: Manage Route Stops (dedicated page for editing a lane's intermediate stops) */}
      {manageStopsLane && (
        <ManageLaneStopsModal
          lane={lanes.find(l => l.id === manageStopsLane.id) || manageStopsLane}
          onClose={() => setManageStopsLane(null)}
          onSave={handleUpdateLaneStops}
        />
      )}

      {/* MODAL: Edit Lane (emergency reroute, carrier/cargo/temp range changes) */}
      {editLaneLane && (
        <EditLaneModal
          lane={lanes.find(l => l.id === editLaneLane.id) || editLaneLane}
          onClose={() => setEditLaneLane(null)}
          onSave={handleUpdateLane}
        />
      )}

      {/* MODAL 2: Temperature Control & Real-time Alert Monitoring System */}
      {tempModalLane && (
        <TemperatureMonitoringSystem
          lane={lanes.find(l => l.id === tempModalLane.id) || tempModalLane}
          onClose={() => setTempModalLane(null)}
          onUpdateLaneTemp={handleUpdateLaneTemp}
          onOpenReports={() => {
            setTempModalLane(null);
            setIsReportsModalOpen(true);
          }}
        />
      )}

      {/* MODAL 3: 3-Step Guided Lane Creation Wizard */}
      {isNewLaneWizardOpen && (
        <NewLaneWizardModal
          onClose={() => setIsNewLaneWizardOpen(false)}
          onCreateLane={handleCreateLane}
          onViewLane={(lane) => setRiskModalLane(lane)}
          onLogAuditEntry={appendAuditLog}
          dataSource={dataSource}
        />
      )}

      {/* MODAL 4: Automated Reporting Capabilities & Dossiers */}
      {isReportsModalOpen && (
        <AutomatedReportingModal
          lanes={lanes}
          alerts={alerts}
          logs={auditLogs}
          capaRecords={capaRecords}
          currentUser={currentUser}
          onClose={() => setIsReportsModalOpen(false)}
        />
      )}

      {/* MODAL 5: Supabase Cloud Database & GitHub Sync Modal */}
      {isCloudSyncOpen && (
        <SupabaseSyncModal
          isOpen={isCloudSyncOpen}
          onClose={() => setIsCloudSyncOpen(false)}
          lanes={lanes}
          alerts={alerts}
          auditLogs={auditLogs}
        />
      )}

      {/* DRAWER: Real-Time Alerts Center */}
      {isAlertsCenterOpen && (
        <RealTimeAlertsCenter
          alerts={alerts}
          lanes={lanes}
          realtimeStatus={realtimeStatus}
          currentUserRole={currentUser?.role}
          onClose={() => setIsAlertsCenterOpen(false)}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onSelectLaneByCode={(code) => {
            const found = lanes.find(l => l.laneCode === code);
            if (found) {
              setRiskModalLane(found);
              setIsAlertsCenterOpen(false);
            }
          }}
          onOpenReportForAlert={(alt) => {
            setIsAlertsCenterOpen(false);
            setIsReportsModalOpen(true);
          }}
        />
      )}

      {/* Keyboard-first Command Palette (Cmd/Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        lanes={lanes}
        onSelectLane={(lane) => setRiskModalLane(lane)}
        onCreateLane={() => setIsNewLaneWizardOpen(true)}
        onOpenAlerts={() => setIsAlertsCenterOpen(true)}
        onOpenSettings={() => setActiveTab('SETTINGS')}
        onSwitchTab={handleSwitchTab}
        onOpenAssistant={() => setIsChatAssistantOpen(true)}
      />

      {/* Conversational Assistant Panel */}
      <ChatAssistant
        isOpen={isChatAssistantOpen}
        onClose={() => setIsChatAssistantOpen(false)}
        currentUser={currentUser}
        dataSource={dataSource}
        isAuthenticated={isAuthenticated}
        onLaneCreated={handleLaneCreatedViaChat}
        onRequireSignIn={() => {
          setIsChatAssistantOpen(false);
          setPlanModalContext('signin');
          setShowPlanModal(true);
        }}
        onRequireApiKey={() => {
          setIsChatAssistantOpen(false);
          setSettingsFocusTab({ tab: 'COMPLIANCE' });
          setActiveTab('SETTINGS');
        }}
      />

      {/* Persistent Global Footer */}
      <footer className={`border-t px-4 sm:px-6 py-4 mt-8 ${lightShell ? 'bg-white border-slate-200' : 'bg-slate-950/90 border-slate-800/80'}`}>
        <div className={`max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${lightShell ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PharmaTrack Logistics Platform • Good Distribution Practice Compliant (GDP 2013/C 343/01)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>{isAuthenticated ? 'Signed in as' : 'Viewing as'}: <strong className={lightShell ? 'text-slate-900' : 'text-slate-200'}>{currentUser.name}</strong> ({currentUser.role})</span>
            <span className="font-mono">
              {dataSource === 'cloud' ? `Supabase Cloud (${lanes.length} lanes)` : dataSource === 'local' ? 'Local Demo Dataset' : 'Connecting…'}
            </span>
            <LiveIndicator status={realtimeStatus} className="font-mono" />
          </div>
        </div>
      </footer>

      </div>
    </div>
  );
}
