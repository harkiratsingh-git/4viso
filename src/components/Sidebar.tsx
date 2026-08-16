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
  ChevronUp,
  Bot,
} from 'lucide-react';
import { UserRole, SupabaseUser } from '../types';

export type AppTab = 'DASHBOARD' | 'LANES' | 'COMPLIANCE' | 'AUDIT_LOGS' | 'SETTINGS' | 'LOGIN';

export const USER_ROLES: UserRole[] = [
  { id: 'quality', title: 'Quality Assurance Lead', department: 'Global QA & Validation', name: 'Dr. Elena Rostova' },
  { id: 'logistics', title: 'Logistics Operations Lead', department: 'Cold Chain Logistics', name: 'Marcus Vance' },
  { id: 'auditor', title: 'GDP Compliance Auditor', department: 'Regulatory Affairs', name: 'Sarah Jenkins' },
  { id: 'executive', title: 'Senior IoT Telemetry VP', department: 'Executive Oversight', name: 'Alex Chen' },
];

interface SidebarProps {
  activeTab: AppTab;
  onSwitchTab: (tab: AppTab) => void;
  onOpenNewLane: () => void;
  onOpenReports: () => void;
  onOpenCloudSync?: () => void;
  onOpenAssistant?: () => void;
  onLogout?: () => void;
  currentUser?: SupabaseUser;
  activeRole: UserRole;
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
}

const NavRow: React.FC<NavRowProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full min-h-[38px] flex items-center gap-2.5 px-3 rounded-lg text-xs font-semibold transition-all text-left ${
      active
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/60'
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
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
  activeRole,
  className = 'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen',
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <aside className={`w-60 flex-shrink-0 bg-slate-950 border-r border-slate-800 h-full ${className}`}>
      {/* Logo & Wordmark */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-sm tracking-wider text-white truncate">PHARMATRACK</div>
          <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block">
            GDP Validated
          </span>
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">Monitoring</div>
          <div className="space-y-0.5">
            {onOpenAssistant && (
              <NavRow icon={<Bot className="w-4 h-4 text-teal-400" />} label="PharmaTrack Assistant" onClick={onOpenAssistant} />
            )}
            <NavRow
              icon={<LayoutDashboard className="w-4 h-4 text-emerald-400" />}
              label="Global Dashboard"
              active={activeTab === 'DASHBOARD'}
              onClick={() => onSwitchTab('DASHBOARD')}
            />
            <NavRow
              icon={<Layers className="w-4 h-4 text-teal-400" />}
              label="Lane Risk Management"
              active={activeTab === 'LANES'}
              onClick={() => onSwitchTab('LANES')}
            />
            <NavRow
              icon={<ShieldCheck className="w-4 h-4 text-teal-400" />}
              label="GDP Compliance Trends"
              active={activeTab === 'COMPLIANCE'}
              onClick={() => onSwitchTab('COMPLIANCE')}
            />
            <NavRow
              icon={<History className="w-4 h-4 text-sky-400" />}
              label="Immutable Audit Trail"
              active={activeTab === 'AUDIT_LOGS'}
              onClick={() => onSwitchTab('AUDIT_LOGS')}
            />
          </div>
        </div>

        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">Account</div>
          <div className="space-y-0.5">
            <NavRow
              icon={<FileText className="w-4 h-4 text-slate-400" />}
              label="Reports"
              onClick={onOpenReports}
            />
            {onOpenCloudSync && (
              <NavRow
                icon={<Database className="w-4 h-4 text-slate-400" />}
                label="Supabase Cloud"
                onClick={onOpenCloudSync}
              />
            )}
            <NavRow
              icon={<SettingsIcon className="w-4 h-4 text-slate-400" />}
              label="Settings & Integrations"
              active={activeTab === 'SETTINGS'}
              onClick={() => onSwitchTab('SETTINGS')}
            />
            <NavRow
              icon={<UserCheck className="w-4 h-4 text-slate-400" />}
              label="Sign In / Personas"
              active={activeTab === 'LOGIN'}
              onClick={() => onSwitchTab('LOGIN')}
            />
          </div>
        </div>
      </nav>

      {/* Pinned Primary Action + User Row */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
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
              className="absolute bottom-full left-0 mb-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs"
              onMouseLeave={() => setIsUserMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout?.();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
          >
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
              alt={currentUser?.name || activeRole.name}
              className="w-7 h-7 rounded-full border border-teal-500/40 object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate">{currentUser?.name || activeRole.name}</div>
              <div className="text-[9px] text-teal-400 truncate">{currentUser?.role || activeRole.title}</div>
            </div>
            <ChevronUp className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${isUserMenuOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>
    </aside>
  );
};
