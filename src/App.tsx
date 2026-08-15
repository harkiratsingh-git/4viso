import React, { useState, useEffect } from 'react';
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
  SupabaseUser
} from './types';
import { Header, USER_ROLES } from './components/Header';
import { KpiOverview } from './components/KpiOverview';
import { GlobalNetworkMap } from './components/GlobalNetworkMap';
import { WeatherDisruptions } from './components/WeatherDisruptions';
import { FilterToolbar } from './components/FilterToolbar';
import { LaneManagementTable } from './components/LaneManagementTable';
import { LaneRiskAssessmentModal } from './components/LaneRiskAssessmentModal';
import { TemperatureMonitoringSystem } from './components/TemperatureMonitoringSystem';
import { NewLaneWizardModal } from './components/NewLaneWizardModal';
import { RealTimeAlertsCenter } from './components/RealTimeAlertsCenter';
import { GdpComplianceTrend } from './components/GdpComplianceTrend';
import { AuditTrailView } from './components/AuditTrailView';
import { AutomatedReportingModal } from './components/AutomatedReportingModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { SettingsPage } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { getActiveUser, setActiveUser as persistActiveUser } from './services/supabaseService';
import { 
  LayoutDashboard, 
  Layers, 
  ShieldCheck, 
  History, 
  Activity, 
  AlertTriangle,
  FileText,
  Settings as SettingsNavIcon,
  UserCheck
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LANES' | 'COMPLIANCE' | 'AUDIT_LOGS' | 'SETTINGS' | 'LOGIN'>('DASHBOARD');
  
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
  const [isNewLaneWizardOpen, setIsNewLaneWizardOpen] = useState<boolean>(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);
  const [isAlertsCenterOpen, setIsAlertsCenterOpen] = useState<boolean>(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);

  // Simulation engine state
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Periodic IoT telemetry background simulation ticker
  useEffect(() => {
    if (!isSimulating) return;

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
            ambientTemp: Number((latestReading?.ambientTemp || 22 + delta * 2).toFixed(1)),
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
  }, [isSimulating]);

  // Log an event into immutable audit trail
  const appendAuditLog = (
    laneCode: string,
    action: string,
    category: AuditLogEntry['category'],
    details: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
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
          acknowledgedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
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
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
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

  // Filter application
  const filteredLanes = lanes.filter(lane => {
    if (filters.searchQuery.trim() !== '') {
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

    if (filters.mode !== 'All' && lane.mode !== filters.mode) return false;

    if (filters.riskSeverity !== 'All' && lane.riskLevel !== filters.riskSeverity) return false;

    if (filters.gdpStatus !== 'All' && lane.gdpStatus !== filters.gdpStatus) return false;

    if (filters.tempStatus === 'Compliant' && (lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin)) return false;
    if (filters.tempStatus === 'Warning' && (lane.currentTemp < lane.tempMax - 0.8 && lane.currentTemp > lane.tempMin + 0.8)) return false;
    if (filters.tempStatus === 'Excursion' && !(lane.currentTemp > lane.tempMax || lane.currentTemp < lane.tempMin)) return false;

    if (filters.productCategory !== 'All' && lane.productCategory !== filters.productCategory) return false;

    if (filters.showOnlyAlerts && lane.status !== 'Temperature Alert' && lane.riskScore < 40) return false;

    return true;
  });

  const unreadAlerts = alerts.filter(a => !a.isAcknowledged);

  return (
    <div className="min-h-screen bg-[#070d14] text-slate-100 font-sans selection:bg-teal-500 selection:text-white flex flex-col">
      
      {/* Top Application Header */}
      <Header
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onOpenNewLane={() => setIsNewLaneWizardOpen(true)}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenAlerts={() => setIsAlertsCenterOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenSettings={() => setActiveTab('SETTINGS')}
        onOpenLogin={() => setActiveTab('LOGIN')}
        currentUser={currentUser}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
        unreadAlerts={unreadAlerts}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        onTriggerSimulatedExcursion={handleTriggerSimulatedExcursion}
        onResetData={handleResetData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between gap-4 mb-5 border-b border-slate-800/80 pb-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'DASHBOARD'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-emerald-400" />
              <span>Global Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('LANES')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'LANES'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-teal-400" />
              <span>Lane Risk Management</span>
            </button>

            <button
              onClick={() => setActiveTab('COMPLIANCE')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'COMPLIANCE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>GDP Compliance Trends</span>
            </button>

            <button
              onClick={() => setActiveTab('AUDIT_LOGS')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'AUDIT_LOGS'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <History className="w-4 h-4 text-sky-400" />
              <span>Immutable Audit Trail</span>
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'SETTINGS'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <SettingsNavIcon className="w-4 h-4 text-amber-400" />
              <span>Settings & Integrations</span>
            </button>

            <button
              onClick={() => setActiveTab('LOGIN')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeTab === 'LOGIN'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-purple-400" />
              <span>Sign In / Personas</span>
            </button>
          </div>

          {/* Quick Active Excursion Warning Banner if critical alerts exist */}
          {unreadAlerts.filter(a => a.severity === 'Critical').length > 0 && (
            <button
              onClick={() => setIsAlertsCenterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse hover:bg-rose-500/30 whitespace-nowrap transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{unreadAlerts.filter(a => a.severity === 'Critical').length} Critical Excursions Active</span>
            </button>
          )}
        </div>

        {/* TAB 1: Global Dashboard Overview */}
        {activeTab === 'DASHBOARD' && (
          <div>
            {/* Top KPI Metrics */}
            <KpiOverview
              lanes={lanes}
              onSelectFilter={(key, value) => {
                setFilters(prev => ({ ...prev, [key]: value }));
                setActiveTab('LANES');
              }}
            />

            {/* Interactive World Route Map */}
            <GlobalNetworkMap
              lanes={lanes}
              selectedLaneId={riskModalLane?.id || null}
              onSelectLane={(lane) => setRiskModalLane(lane)}
            />

            {/* Weather & Route Disruption Alerts Feed */}
            <WeatherDisruptions
              disruptions={disruptions}
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
            />
          </div>
        )}

        {/* TAB 3: GDP Compliance & Audit Trends */}
        {activeTab === 'COMPLIANCE' && (
          <div>
            <GdpComplianceTrend onOpenAuditReport={() => setIsReportsModalOpen(true)} />
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
          onClose={() => setRiskModalLane(null)}
          onOpenTempMonitor={(l) => {
            setRiskModalLane(null);
            setTempModalLane(l);
          }}
          onAddRiskFactor={handleAddRiskFactor}
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
        />
      )}

      {/* MODAL 4: Automated Reporting Capabilities & Dossiers */}
      {isReportsModalOpen && (
        <AutomatedReportingModal
          lanes={lanes}
          alerts={alerts}
          logs={auditLogs}
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

      {/* Persistent Global Footer */}
      <footer className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PharmaTrack Logistics Platform • Good Distribution Practice Compliant (GDP 2013/C 343/01)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Logged in as: <strong className="text-slate-200">{activeRole.name}</strong> ({activeRole.title})</span>
            <span className="font-mono text-emerald-400">IoT Fleet: 8 Online</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
