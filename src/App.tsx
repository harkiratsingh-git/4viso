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
  UserRole,
  AlertNotification,
  AuditLogEntry,
  RiskFactor,
  TemperatureReading,
  SystemSettings,
  SupabaseUser,
  CorridorAdvisory
} from './types';
import { Sidebar, USER_ROLES, AppTab } from './components/Sidebar';
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
import { isLaneExcursing, isLaneHighRisk, getEffectiveRiskLevel, getEffectiveRiskScore } from './utils/laneRisk';
import { deriveDisruptionsFromAdvisories } from './utils/corridorAdvisories';
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
import { SettingsPage } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { getActiveUser, setActiveUser as persistActiveUser, DEFAULT_SUPABASE_USER, fetchAllFromSupabase, restoreSupabaseSession, signOutFromSupabase, fetchDashboardSummary, DashboardSummary, getSupabaseClient, searchLanesRemote, insertAuditLogEntry, syncLaneRiskToSupabase, fetchCorridorAdvisories, fetchCapaRecords, CapaRecord, fetchGdpComplianceSnapshots, GdpComplianceSnapshot } from './services/supabaseService';
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

  // User & Settings states
  const [currentUser, setCurrentUser] = useState<SupabaseUser>(getActiveUser());
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('pharmatrack_system_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Active Role and Navigation Tab
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const usr = getActiveUser();
    return USER_ROLES.find(r => r.title.toLowerCase().includes(usr.role.toLowerCase().slice(0, 4))) || USER_ROLES[0];
  });
  const [activeTab, setActiveTab] = useState<AppTab>('DASHBOARD');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  
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
        const matchingRole = USER_ROLES.find(r => r.title.toLowerCase().includes(user.role.toLowerCase().slice(0, 4)));
        if (matchingRole) setActiveRole(matchingRole);
      })
      .catch(err => console.warn('Failed to restore Supabase session:', err));

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
      actor: currentUser?.name || activeRole.name,
      role: currentUser?.role || activeRole.title,
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
    const matchingRole = USER_ROLES.find(r => r.title.toLowerCase().includes(updatedUser.role.toLowerCase().slice(0, 4)));
    if (matchingRole) setActiveRole(matchingRole);
    appendAuditLog('AUTH', 'Updated Signatory Profile', 'SECURITY', `Signatory updated to ${updatedUser.name} (${updatedUser.role}).`);
  };

  // Login Success handler
  const handleLoginSuccess = (user: SupabaseUser, role?: UserRole) => {
    setCurrentUser(user);
    persistActiveUser(user);
    if (role) {
      setActiveRole(role);
    } else {
      const matchingRole = USER_ROLES.find(r => r.title.toLowerCase().includes(user.role.toLowerCase().slice(0, 4)));
      if (matchingRole) setActiveRole(matchingRole);
    }
    setActiveTab('DASHBOARD');
    appendAuditLog('AUTH', 'User Authentication Success', 'SECURITY', `User authenticated as ${user.name} (${user.role}) via ${user.authProvider || 'Email/Password'}.`);
  };

  // Sign out current user and return to login screen
  const handleLogout = () => {
    appendAuditLog('AUTH', 'User Signed Out', 'SECURITY', `${currentUser?.name || activeRole.name} ended their authenticated session.`);
    signOutFromSupabase().catch(() => {});
    persistActiveUser(DEFAULT_SUPABASE_USER);
    setCurrentUser(DEFAULT_SUPABASE_USER);
    setActiveRole(USER_ROLES[0]);
    setActiveTab('LOGIN');
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
  };

  // Full lane edit (emergency reroute, carrier/cargo change, etc.) from the Edit Lane page
  const handleUpdateLane = (
    laneId: string,
    updates: Parameters<React.ComponentProps<typeof EditLaneModal>['onSave']>[1],
    certificationIssues: CertificationIssue[]
  ) => {
    setLanes(prev => prev.map(l => (l.id === laneId ? { ...l, ...updates } : l)));

    const targetLane = lanes.find(l => l.id === laneId);
    const laneCode = targetLane?.laneCode || updates.originIata + '-' + updates.destinationIata;

    appendAuditLog(
      laneCode,
      'Lane Rerouted / Updated',
      'LANE_CONFIGURATION',
      `Route updated to ${updates.originIata} → ${updates.stops.map(s => s.iata).join(' → ')}${updates.stops.length ? ' → ' : ''}${updates.destinationIata} via ${updates.mode} (${updates.carrier}).`
    );

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
          acknowledgedBy: activeRole.name,
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
        `Formally acknowledged by ${activeRole.name} (${activeRole.title}).`
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

  // Real disruption feed: only shown when cloud-connected, since it's derived from live
  // corridor_advisories against live lanes — in local demo mode there's no live advisory feed
  // to check against, so it falls back to the local mock dataset (same fictional universe as
  // the local demo lanes, not mixed with real data).
  const effectiveDisruptions = useMemo(
    () => (dataSource === 'cloud' ? deriveDisruptionsFromAdvisories(lanes, corridorAdvisories) : disruptions),
    [dataSource, lanes, corridorAdvisories, disruptions]
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

  return (
    <div className={`min-h-screen font-sans selection:bg-teal-500 selection:text-white flex ${lightShell ? 'bg-slate-50 text-slate-900' : 'bg-[#070d14] text-slate-100'}`}>

      {/* Persistent Left Sidebar (desktop) */}
      <Sidebar
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onOpenNewLane={() => setIsNewLaneWizardOpen(true)}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenAssistant={() => setIsChatAssistantOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        activeRole={activeRole}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsMobileNavOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar
              activeTab={activeTab}
              onSwitchTab={(tab) => {
                setActiveTab(tab);
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
              activeRole={activeRole}
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
        />

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
        {activeTab === 'DASHBOARD' && viewMode === 'simple' && (
          <SimpleDashboard
            lanes={lanes}
            selectedLaneId={riskModalLane?.id || null}
            onSelectLane={(lane) => setRiskModalLane(lane)}
            onGoAdvanced={() => setViewMode('advanced')}
          />
        )}

        {activeTab === 'DASHBOARD' && viewMode === 'advanced' && (
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
            />
          </div>
        )}

        {/* TAB 3: GDP Compliance & Audit Trends */}
        {activeTab === 'COMPLIANCE' && (
          <div>
            <GdpComplianceTrend
              onOpenAuditReport={() => setIsReportsModalOpen(true)}
              snapshots={dataSource === 'cloud' ? gdpSnapshots : null}
              capaRecords={dataSource === 'cloud' ? capaRecords : []}
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
          />
        )}

        {/* TAB 6: 21 CFR Part 11 Login & Persona Switcher */}
        {activeTab === 'LOGIN' && (
          <div className="py-4">
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              currentUser={currentUser}
            />
          </div>
        )}

      </main>

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
          capaRecords={dataSource === 'cloud' ? capaRecords : []}
          activeRole={activeRole}
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
        onSwitchTab={(tab) => setActiveTab(tab)}
        onOpenAssistant={() => setIsChatAssistantOpen(true)}
      />

      {/* Conversational Assistant Panel */}
      <ChatAssistant
        isOpen={isChatAssistantOpen}
        onClose={() => setIsChatAssistantOpen(false)}
        currentUser={currentUser}
        activeRole={activeRole}
        dataSource={dataSource}
        onLaneCreated={handleLaneCreatedViaChat}
      />

      {/* Persistent Global Footer */}
      <footer className={`border-t px-4 sm:px-6 py-4 mt-8 ${lightShell ? 'bg-white border-slate-200' : 'bg-slate-950/90 border-slate-800/80'}`}>
        <div className={`max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${lightShell ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PharmaTrack Logistics Platform • Good Distribution Practice Compliant (GDP 2013/C 343/01)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Logged in as: <strong className={lightShell ? 'text-slate-900' : 'text-slate-200'}>{activeRole.name}</strong> ({activeRole.title})</span>
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
