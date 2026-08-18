import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Pencil, ShieldCheck } from 'lucide-react';
import { getAirportCoords } from '../utils/geo';
import { PortEntry, searchPorts } from '../utils/ports';
import { usePorts } from '../contexts/PortsContext';
import { useThemeTokens } from '../contexts/ViewModeContext';

export interface AirportValue {
  city: string;
  iata: string;
  country: string;
  coords: [number, number];
}

interface AirportAutocompleteProps {
  label: string;
  value: AirportValue;
  onChange: (val: AirportValue) => void;
  placeholder?: string;
}

/**
 * Single-field location picker: type a city, country, or IATA code and pick a suggestion.
 * Falls back to a manual City/IATA/Country entry for hubs outside the curated directory.
 */
export const AirportAutocomplete: React.FC<AirportAutocompleteProps> = ({
  label,
  value,
  onChange,
  placeholder,
}) => {
  const t = useThemeTokens();
  const [query, setQuery] = useState(value.iata ? `${value.city} (${value.iata})` : '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ports } = usePorts();

  const suggestions = useMemo(() => searchPorts(ports, query), [ports, query]);

  useEffect(() => {
    setQuery(value.iata ? `${value.city} (${value.iata})` : '');
  }, [value.iata, value.city]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectEntry = (entry: PortEntry) => {
    onChange({ city: entry.city, iata: entry.code, country: entry.country, coords: entry.coords });
    setQuery(`${entry.city} (${entry.code})`);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectEntry(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const fieldClass = `bg-transparent border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1.5 ${t.textPrimary} text-xs`;

  if (manualMode) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={`text-[11px] ${t.textMuted}`}>{label}</label>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className={`text-[10px] font-semibold ${t.light ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'}`}
          >
            Search hubs instead
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <input
            type="text"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="City"
            className={`col-span-1 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1.5 ${t.textPrimary} text-xs`}
          />
          <input
            type="text"
            value={value.iata}
            onChange={(e) => {
              const iata = e.target.value.toUpperCase();
              onChange({ ...value, iata, coords: iata.length >= 3 ? getAirportCoords(iata) : value.coords });
            }}
            placeholder="IATA"
            maxLength={4}
            className={`col-span-1 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1.5 ${t.textPrimary} text-xs uppercase`}
          />
          <input
            type="text"
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            placeholder="Country"
            className={`col-span-1 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded px-2 py-1.5 ${t.textPrimary} text-xs`}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className={`text-[11px] ${t.textMuted}`}>{label}</label>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className={`text-[10px] font-semibold flex items-center gap-0.5 ${t.light ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Pencil className="w-2.5 h-2.5" /> Enter manually
        </button>
      </div>
      <div className="relative">
        <MapPin className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${t.textFaint}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Search city, country, or IATA code…'}
          className={`w-full ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg pl-8 pr-3 py-1.5 ${t.textPrimary} text-xs focus:outline-none focus:border-emerald-500`}
          autoComplete="off"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className={`absolute z-20 mt-1 w-full ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg shadow-xl max-h-52 overflow-y-auto`}>
          {suggestions.map((s, i) => (
            <button
              key={s.code}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectEntry(s);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                i === highlighted
                  ? t.light ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-200'
                  : `${t.textSecondary} ${t.hoverBgSubtle}`
              }`}
              title={s.hasGdpCertification ? 'GDP certified facility' : undefined}
            >
              <span className="truncate flex items-center gap-1">
                {s.city} <span className={t.textMuted}>· {s.country}</span>
                {s.hasGdpCertification && <ShieldCheck className={`w-3 h-3 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />}
              </span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${t.chipBg} ${t.light ? 'text-teal-700' : 'text-teal-300'}`}>
                {s.code}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim().length > 0 && suggestions.length === 0 && (
        <div className={`absolute z-20 mt-1 w-full ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg shadow-xl p-3 text-[11px] ${t.textMuted}`}>
          No matching hub in our directory. Use "Enter manually" above for a custom location.
        </div>
      )}

      {value.iata && !isOpen && (
        <div className={`mt-1 text-[10px] ${t.textFaint}`}>{value.country}</div>
      )}
    </div>
  );
};
