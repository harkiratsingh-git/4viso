import React from 'react';
import { Search, Bell, Menu, Sparkles, LayoutGrid, Sun, Moon } from 'lucide-react';
import { AlertNotification } from '../types';
import { LiveIndicator } from './LiveIndicator';
import { useViewMode } from '../contexts/ViewModeContext';

interface TopBarProps {
  pageName: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCommandPalette?: () => void;
  unreadAlerts: AlertNotification[];
  onOpenAlerts: () => void;
  realtimeStatus: 'disabled' | 'connecting' | 'live' | 'reconnecting';
  onOpenMobileNav?: () => void;
}

/**
 * Breadcrumb + title pattern: replaces the old dense top bar (nav tabs, role selector, and 6+
 * badges/buttons all competing in one row). Only 3 right-aligned controls remain — search,
 * notifications, and a live-data indicator — everything else moved into the sidebar.
 */
export const TopBar: React.FC<TopBarProps> = ({
  pageName,
  searchQuery,
  onSearchChange,
  onOpenCommandPalette,
  unreadAlerts,
  onOpenAlerts,
  realtimeStatus,
  onOpenMobileNav,
}) => {
  const { mode, setMode, theme, setTheme } = useViewMode();
  const light = theme === 'light';

  return (
    <header className={`backdrop-blur-md border-b sticky top-0 z-40 px-4 sm:px-6 py-3 ${light ? 'bg-white/90 border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileNav && (
            <button
              onClick={onOpenMobileNav}
              className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-medium truncate">PharmaTrack / {pageName}</div>
            <h1 className={`text-base sm:text-lg font-bold truncate ${light ? 'text-slate-900' : 'text-white'}`}>{pageName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Simple/Advanced view-mode toggle — a separate dimension from light/dark theme. */}
          <div className={`hidden md:flex items-center rounded-lg border p-0.5 text-xs ${light ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-700'}`}>
            <button
              onClick={() => setMode('simple')}
              title="Simple: the essentials — totals, what needs attention, a map"
              className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                mode === 'simple'
                  ? 'bg-emerald-600 text-white'
                  : light ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3" /> Simple
            </button>
            <button
              onClick={() => setMode('advanced')}
              title="Advanced: full operational detail — per-leg routing, comparisons, thermal maps"
              className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                mode === 'advanced'
                  ? 'bg-emerald-600 text-white'
                  : light ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Advanced
            </button>
          </div>

          <button
            onClick={() => setTheme(light ? 'dark' : 'light')}
            title={light ? 'Switch to dark theme' : 'Switch to light theme'}
            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border transition-colors ${
              light ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <div className="relative hidden sm:block w-52 lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search lane, city, carrier…"
              className="w-full pl-9 pr-12 py-1.5 text-xs bg-slate-950/70 text-slate-100 placeholder-slate-500 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
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

          <button
            onClick={onOpenAlerts}
            className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex-shrink-0"
            title="Open Real-time Alerts Panel"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-lg animate-pulse">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          <LiveIndicator status={realtimeStatus} localLabel="Local Simulation" className="hidden lg:inline-flex font-mono text-[11px]" />
        </div>
      </div>
    </header>
  );
};
