import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowRight,
  PlusCircle,
  BellRing,
  Settings as SettingsIcon,
  LayoutGrid,
  Layers,
  ShieldCheck,
  ScrollText,
  CornerDownLeft,
  Bot,
} from 'lucide-react';
import { TransportLane } from '../types';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  lanes: TransportLane[];
  onSelectLane: (lane: TransportLane) => void;
  onCreateLane: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onSwitchTab: (tab: 'DASHBOARD' | 'LANES' | 'COMPLIANCE' | 'AUDIT_LOGS' | 'SETTINGS') => void;
  onOpenAssistant: () => void;
}

interface PaletteItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  lanes,
  onSelectLane,
  onCreateLane,
  onOpenAlerts,
  onOpenSettings,
  onSwitchTab,
  onOpenAssistant,
}) => {
  const t = useThemeTokens();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlighted(0);
      // Focus after the mount frame so the modal is in the DOM first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const actionItems: PaletteItem[] = useMemo(
    () => [
      { id: 'open-assistant', icon: <Bot className={`w-4 h-4 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />, label: 'Ask the PharmaTrack Assistant', run: onOpenAssistant },
      { id: 'create-lane', icon: <PlusCircle className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />, label: 'Create New Lane', run: onCreateLane },
      { id: 'open-alerts', icon: <BellRing className={`w-4 h-4 ${t.light ? 'text-rose-600' : 'text-rose-400'}`} />, label: 'Open Alert Center', run: onOpenAlerts },
      { id: 'open-settings', icon: <SettingsIcon className={`w-4 h-4 ${t.textMuted}`} />, label: 'Open Settings & Integrations', run: onOpenSettings },
      { id: 'tab-dashboard', icon: <LayoutGrid className={`w-4 h-4 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />, label: 'Go to Global Dashboard', run: () => onSwitchTab('DASHBOARD') },
      { id: 'tab-lanes', icon: <Layers className={`w-4 h-4 ${t.light ? 'text-purple-600' : 'text-purple-400'}`} />, label: 'Go to Lane Risk Management', run: () => onSwitchTab('LANES') },
      { id: 'tab-compliance', icon: <ShieldCheck className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />, label: 'Go to GDP Compliance Trends', run: () => onSwitchTab('COMPLIANCE') },
      { id: 'tab-audit', icon: <ScrollText className={`w-4 h-4 ${t.light ? 'text-cyan-600' : 'text-cyan-400'}`} />, label: 'Go to Immutable Audit Trail', run: () => onSwitchTab('AUDIT_LOGS') },
    ],
    [onCreateLane, onOpenAlerts, onOpenSettings, onSwitchTab, onOpenAssistant, t.light, t.textMuted]
  );

  const laneItems: PaletteItem[] = useMemo(
    () =>
      lanes.map((lane) => ({
        id: `lane-${lane.id}`,
        icon: <ArrowRight className={`w-4 h-4 ${t.textFaint}`} />,
        label: `${lane.laneCode} — ${lane.originCity} to ${lane.destinationCity}`,
        hint: `${lane.carrier} · ${lane.mode}`,
        run: () => onSelectLane(lane),
      })),
    [lanes, onSelectLane, t.textFaint]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actionItems;
    const matchedActions = actionItems.filter((i) => i.label.toLowerCase().includes(q));
    const matchedLanes = laneItems.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q)).slice(0, 8);
    return [...matchedActions, ...matchedLanes];
  }, [query, actionItems, laneItems]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlighted];
      if (item) {
        item.run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const kbdClass = `px-1 py-0.5 rounded border ${t.chipBg} ${t.light ? 'border-slate-300' : 'border-slate-700'}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className={`${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${t.border}`}>
          <Search className={`w-4 h-4 flex-shrink-0 ${t.textFaint}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a lane, or run a command…"
            className={`flex-1 bg-transparent text-sm ${t.textPrimary} ${t.light ? 'placeholder-slate-400' : 'placeholder-slate-500'} focus:outline-none`}
          />
          <kbd className={`text-[10px] font-mono flex-shrink-0 ${kbdClass} ${t.textMuted}`}>Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className={`px-4 py-8 text-center text-xs ${t.textFaint}`}>No matches for "{query}"</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className={`w-full min-h-[40px] px-4 flex items-center justify-between gap-2 text-left transition-colors ${
                  i === highlighted
                    ? t.light ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/15 text-emerald-100'
                    : `${t.textSecondary} ${t.hoverBgSubtle}`
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate text-xs font-medium">{item.label}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {item.hint && <span className={`text-[10px] ${t.textFaint}`}>{item.hint}</span>}
                  {i === highlighted && <CornerDownLeft className={`w-3 h-3 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />}
                </span>
              </button>
            ))
          )}
        </div>

        <div className={`px-4 py-2 ${t.cardBgSunken} border-t ${t.border} text-[10px] ${t.textFaint} flex items-center gap-3`}>
          <span className="flex items-center gap-1"><kbd className={kbdClass}>↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className={kbdClass}>Enter</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className={kbdClass}>⌘K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  );
};
