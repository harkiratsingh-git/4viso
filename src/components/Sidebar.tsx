import React, { useState } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Layers,
  History,
  FileText,
  Database,
  Settings as SettingsIcon,
  UserCheck,
  PlusCircle,
  LogOut,
  LogIn,
  ChevronUp,
  Bot,
  Lock,
} from 'lucide-react';
import { UserRole, SupabaseUser } from '../types';
import { useViewMode } from '../contexts/ViewModeContext';
import { Avatar } from './Avatar';

export type AppTab = 'DASHBOARD' | 'LANES' | 'COMPLIANCE' | 'AUDIT_LOGS' | 'SETTINGS' | 'LOGIN';

/** Role metadata (title/department) for display purposes only — not a tracked "active persona"
 *  state. currentUser.role is the one source of truth for who someone actually is. */
export const USER_ROLES: UserRole[] = [
  { id: 'quality', title: 'Quality Assurance Lead', department: 'Global QA & Validation', name: 'Quality Lead' },
  { id: 'logistics', title: 'Logistics Operations Lead', department: 'Cold Chain Logistics', name: 'Logistics Director' },
  { id: 'auditor', title: 'GDP Compliance Auditor', department: 'Regulatory Affairs', name: 'GDP Auditor' },
  { id: 'executive', title: 'Supply Chain Analyst', department: 'Predictive Analytics & IoT', name: 'Supply Chain Analyst' },
];

interface SidebarProps {
  activeTab: AppTab;
  onSwitchTab: (tab: AppTab) => void;
  onOpenNewLane: () => void;
  onOpenReports: () => void;
  onOpenCloudSync?: () => void;
  onOpenAssistant?: () => void;
  onLogout?: () => void;
  currentUser: SupabaseUser;
  isAuthenticated: boolean;
  /** Visibility/positioning classes for the root <aside> — the persistent desktop rail hides
   *  below `md`, but the same component reused inside a mobile overlay drawer must stay
   *  visible, so the caller controls this rather than it being hardcoded here. */
  className?: string;
}

interface NavRowProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  light: boolean;
  /** This item is reachable but requires a real Supabase Auth session — clicking it still
   *  works (App.tsx routes it through the plan-selection gate), this is just an at-a-glance
   *  hint before the click, not a disabled state. */
  locked?: boolean;
}

const NavRow: React.FC<NavRowProps> = ({ icon, label, active, onClick, light, locked }) => (
  <button
    onClick={onClick}
    title={locked ? `${label} — requires sign-in` : undefined}
    className={`w-full min-h-[38px] flex items-center gap-2.5 px-3 rounded-lg text-xs font-semibold transition-all text-left ${
      active
        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
        : light
        ? 'text-slate-500 border border-transparent hover:text-slate-800 hover:bg-slate-100'
        : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/60'
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="truncate flex-1">{label}</span>
    {locked && <Lock className="w-3 h-3 flex-shrink-0 opacity-60" />}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSwitchTab,
  onOpenNewLane,
  onOpenReports,
  onOpenCloudSync,
  onOpenAssistant,
  onLogout,
  currentUser,
  isAuthenticated,
  className = 'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen',
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { theme } = useViewMode();
  const light = theme === 'light';

  return (
    <aside className={`w-60 flex-shrink-0 border-r h-full ${light ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'} ${className}`}>
      {/* Logo & Wordmark */}
      <div className={`px-4 py-4 flex items-center gap-2.5 border-b ${light ? 'border-slate-200' : 'border-slate-800/80'}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className={`font-extrabold text-sm tracking-wider truncate ${light ? 'text-slate-900' : 'text-white'}`}>PHARMATRACK</div>
          <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 inline-block">
            GDP Validated
          </span>
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <div className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest ${light ? 'text-slate-400' : 'text-slate-600'}`}>Monitoring</div>
          <div className="space-y-0.5">
            {onOpenAssistant && (
              <NavRow icon={<Bot className="w-4 h-4 text-teal-500" />} label="PharmaTrack Assistant" onClick={onOpenAssistant} light={light} />
            )}
            <NavRow
              icon={<LayoutDashboard className="w-4 h-4 text-emerald-500" />}
              label="Global Dashboard"
              active={activeTab === 'DASHBOARD'}
              onClick={() => onSwitchTab('DASHBOARD')}
              light={light}
            />
            <NavRow
              icon={<Layers className="w-4 h-4 text-teal-500" />}
              label="Lane Risk Management"
              active={activeTab === 'LANES'}
              onClick={() => onSwitchTab('LANES')}
              light={light}
            />
            <NavRow
              icon={<ShieldCheck className="w-4 h-4 text-teal-500" />}
              label="GDP Compliance Trends"
              active={activeTab === 'COMPLIANCE'}
              onClick={() => onSwitchTab('COMPLIANCE')}
              light={light}
            />
            <NavRow
              icon={<History className="w-4 h-4 text-sky-500" />}
              label="Immutable Audit Trail"
              active={activeTab === 'AUDIT_LOGS'}
              onClick={() => onSwitchTab('AUDIT_LOGS')}
              light={light}
            />
          </div>
        </div>

        <div>
          <div className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest ${light ? 'text-slate-400' : 'text-slate-600'}`}>Account</div>
          <div className="space-y-0.5">
            <NavRow
              icon={<FileText className={`w-4 h-4 ${light ? 'text-slate-400' : 'text-slate-400'}`} />}
              label="Reports"
              onClick={onOpenReports}
              light={light}
            />
            {onOpenCloudSync && (
              <NavRow
                icon={<Database className="w-4 h-4 text-slate-400" />}
                label="Supabase Cloud"
                onClick={onOpenCloudSync}
                light={light}
              />
            )}
            <NavRow
              icon={<SettingsIcon className="w-4 h-4 text-slate-400" />}
              label="Settings & Integrations"
              active={activeTab === 'SETTINGS'}
              onClick={() => onSwitchTab('SETTINGS')}
              light={light}
            />
            {!isAuthenticated && (
              <NavRow
                icon={<UserCheck className="w-4 h-4 text-slate-400" />}
                label="Sign In / Register"
                active={activeTab === 'LOGIN'}
                onClick={() => onSwitchTab('LOGIN')}
                light={light}
              />
            )}
          </div>
        </div>
      </nav>

      {/* Pinned Primary Action + User Row */}
      <div className={`p-3 border-t space-y-2 ${light ? 'border-slate-200' : 'border-slate-800/80'}`}>
        <button
          onClick={onOpenNewLane}
          className="w-full min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Lane</span>
        </button>

        <div className="relative">
          {isUserMenuOpen && (
            <div
              className={`absolute bottom-full left-0 mb-2 w-full rounded-xl shadow-2xl z-50 p-1.5 text-xs border ${light ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
              onMouseLeave={() => setIsUserMenuOpen(false)}
            >
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSwitchTab('SETTINGS');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 ${light ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Profile Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 ${light ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSwitchTab('LOGIN');
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 ${light ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors text-left ${light ? 'hover:bg-slate-100' : 'hover:bg-slate-800/60'}`}
          >
            <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-bold truncate ${light ? 'text-slate-900' : 'text-white'}`}>{currentUser.name}</div>
              <div className="text-[9px] text-teal-500 truncate">{isAuthenticated ? currentUser.role : 'Local Simulation'}</div>
            </div>
            <ChevronUp className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${isUserMenuOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>
    </aside>
  );
};
