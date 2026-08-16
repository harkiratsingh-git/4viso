import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  PlusCircle, 
  FileText, 
  Bell, 
  Radio, 
  Play, 
  Pause, 
  RefreshCw,
  Search,
  UserCheck,
  AlertTriangle,
  Database,
  Settings as SettingsIcon,
  LogOut,
  User,
  ChevronDown,
  Lock
} from 'lucide-react';
import { AlertNotification, UserRole, SupabaseUser } from '../types';

interface HeaderProps {
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenNewLane: () => void;
  onOpenReports: () => void;
  onOpenAlerts: () => void;
  onOpenCloudSync?: () => void;
  onOpenSettings?: () => void;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  currentUser?: SupabaseUser;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  unreadAlerts: AlertNotification[];
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onTriggerSimulatedExcursion: () => void;
  onResetData: () => void;
  onOpenCommandPalette?: () => void;
}

export const USER_ROLES: UserRole[] = [
  { id: 'quality', title: 'Quality Assurance Lead', department: 'Global QA & Validation', name: 'Dr. Elena Rostova' },
  { id: 'logistics', title: 'Logistics Operations Lead', department: 'Cold Chain Logistics', name: 'Marcus Vance' },
  { id: 'auditor', title: 'GDP Compliance Auditor', department: 'Regulatory Affairs', name: 'Sarah Jenkins' },
  { id: 'executive', title: 'Senior IoT Telemetry VP', department: 'Executive Oversight', name: 'Alex Chen' },
];

export const Header: React.FC<HeaderProps> = ({
  activeRole,
  onRoleChange,
  onOpenNewLane,
  onOpenReports,
  onOpenAlerts,
  onOpenCloudSync,
  onOpenSettings,
  onOpenLogin,
  onLogout,
  currentUser,
  searchQuery,
  onSearchChange,
  unreadAlerts,
  isSimulating,
  onToggleSimulation,
  onTriggerSimulatedExcursion,
  onResetData,
  onOpenCommandPalette,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const criticalCount = unreadAlerts.filter(a => a.severity === 'Critical').length;
  const warningCount = unreadAlerts.filter(a => a.severity === 'Warning').length;

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & System Status */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base lg:text-lg tracking-wider text-white">PHARMATRACK</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  GDP Validated
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Intelligence-Driven Pharmaceutical Logistics & Risk Mitigation
              </p>
            </div>
          </div>

          {/* Telemetry Live Pulse for Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onOpenAlerts}
              className="relative p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <Bell className="w-5 h-5" />
              {unreadAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  {unreadAlerts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full md:max-w-xs lg:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search lane, city, carrier (e.g. BRU-SIN, DHL)..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950/70 text-slate-100 placeholder-slate-500 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          ) : onOpenCommandPalette ? (
            <button
              onClick={onOpenCommandPalette}
              title="Open command palette: jump to any lane, or run a command"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              ⌘K
            </button>
          ) : null}
        </div>

        {/* Controls, Role Selector & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
          
          {/* Live Simulation Controls */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={onToggleSimulation}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-medium transition-all ${
                isSimulating 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isSimulating ? 'Pause IoT sensor telemetry stream' : 'Resume IoT sensor telemetry stream'}
            >
              <Radio className={`w-3.5 h-3.5 ${isSimulating ? 'animate-pulse text-emerald-400' : ''}`} />
              <span className="hidden xl:inline">{isSimulating ? 'IoT Live' : 'IoT Paused'}</span>
            </button>

            <button
              onClick={onTriggerSimulatedExcursion}
              className="px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[11px] font-medium flex items-center gap-1 transition-all"
              title="Inject simulated temperature excursion into live fleet (demo/test control — red is reserved for genuine unresolved alerts)"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="hidden lg:inline">Excursion</span>
            </button>

            <button
              onClick={onResetData}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              title="Reset to default dataset"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Automated Reports Modal Button */}
          <button
            onClick={onOpenReports}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-sm"
            title="Automated GDP Audit Reports"
          >
            <FileText className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Reports</span>
          </button>

          {/* Supabase Cloud Quick Access Button */}
          {onOpenCloudSync && (
            <button
              onClick={onOpenCloudSync}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium border border-emerald-700/50 transition-colors shadow-sm"
              title="Open Supabase Cloud Database Integration & SQL Migration"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Supabase Cloud</span>
            </button>
          )}

          {/* Settings Trigger */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-sm"
              title="Open System Settings & Integration Hub"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          {/* Notification Center Trigger */}
          <button
            onClick={onOpenAlerts}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Open Real-time Alerts Panel"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-lg animate-pulse">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {/* Add New Transport Lane Wizard Button */}
          <button
            onClick={onOpenNewLane}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-700/20 transition-all active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Lane</span>
          </button>

          {/* User Account / Sign In / Role Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs text-slate-200 transition-all"
            >
              <img
                src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
                alt={currentUser?.name || activeRole.name}
                className="w-6 h-6 rounded-full border border-teal-500/40 object-cover"
              />
              <div className="text-left hidden lg:block max-w-[120px]">
                <div className="text-[11px] font-bold text-white truncate">
                  {currentUser?.name || activeRole.name}
                </div>
                <div className="text-[9px] text-teal-400 truncate">
                  {currentUser?.role || activeRole.title}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 text-xs backdrop-blur-xl animate-fadeIn"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="p-2 border-b border-slate-800 mb-1">
                  <div className="font-bold text-white text-xs">
                    {currentUser?.name || activeRole.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {currentUser?.email || 'elena.rostova@biopharma-coldchain.com'}
                  </div>
                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {currentUser?.role || activeRole.title}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenSettings) onOpenSettings();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings & Cloud Config</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenCloudSync) onOpenCloudSync();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Supabase Database Schema</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenLogin) onOpenLogin();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>Switch Role / Sign In</span>
                  </button>

                  <div className="border-t border-slate-800 pt-1 mt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
