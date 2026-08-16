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
      { id: 'open-assistant', icon: <Bot className="w-4 h-4 text-teal-400" />, label: 'Ask the PharmaTrack Assistant', run: onOpenAssistant },
      { id: 'create-lane', icon: <PlusCircle className="w-4 h-4 text-emerald-400" />, label: 'Create New Lane', run: onCreateLane },
      { id: 'open-alerts', icon: <BellRing className="w-4 h-4 text-rose-400" />, label: 'Open Alert Center', run: onOpenAlerts },
      { id: 'open-settings', icon: <SettingsIcon className="w-4 h-4 text-slate-400" />, label: 'Open Settings & Integrations', run: onOpenSettings },
      { id: 'tab-dashboard', icon: <LayoutGrid className="w-4 h-4 text-teal-400" />, label: 'Go to Global Dashboard', run: () => onSwitchTab('DASHBOARD') },
      { id: 'tab-lanes', icon: <Layers className="w-4 h-4 text-purple-400" />, label: 'Go to Lane Risk Management', run: () => onSwitchTab('LANES') },
      { id: 'tab-compliance', icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, label: 'Go to GDP Compliance Trends', run: () => onSwitchTab('COMPLIANCE') },
      { id: 'tab-audit', icon: <ScrollText className="w-4 h-4 text-cyan-400" />, label: 'Go to Immutable Audit Trail', run: () => onSwitchTab('AUDIT_LOGS') },
    ],
    [onCreateLane, onOpenAlerts, onOpenSettings, onSwitchTab, onOpenAssistant]
  );

  const laneItems: PaletteItem[] = useMemo(
    () =>
      lanes.map((lane) => ({
        id: `lane-${lane.id}`,
        icon: <ArrowRight className="w-4 h-4 text-slate-500" />,
        label: `${lane.laneCode} — ${lane.originCity} to ${lane.destinationCity}`,
        hint: `${lane.carrier} · ${lane.mode}`,
        run: () => onSelectLane(lane),
      })),
    [lanes, onSelectLane]
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

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a lane, or run a command…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">No matches for "{query}"</div>
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
                  i === highlighted ? 'bg-emerald-500/15 text-emerald-100' : 'text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate text-xs font-medium">{item.label}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {item.hint && <span className="text-[10px] text-slate-500">{item.hint}</span>}
                  {i === highlighted && <CornerDownLeft className="w-3 h-3 text-emerald-400" />}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700">Enter</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700">⌘K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  );
};
