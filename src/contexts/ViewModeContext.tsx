import React, { createContext, useContext, useEffect, useState } from 'react';

export type ViewMode = 'simple' | 'advanced';
export type AppTheme = 'dark' | 'light';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const STORAGE_KEY_MODE = 'pharmatrack_view_mode';
const STORAGE_KEY_THEME = 'pharmatrack_theme';

const ViewModeContext = createContext<ViewModeContextValue>({
  mode: 'simple',
  setMode: () => {},
  theme: 'dark',
  setTheme: () => {},
});

function readStoredMode(): ViewMode {
  try {
    // No saved preference yet = a new session, which defaults to Simple. Once someone picks
    // Advanced it's remembered from then on, same as the theme preference below.
    return localStorage.getItem(STORAGE_KEY_MODE) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

function readStoredTheme(): AppTheme {
  try {
    return localStorage.getItem(STORAGE_KEY_THEME) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ViewMode>(readStoredMode);
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, m);
    } catch {
      // ignore — preference just won't persist across reloads
    }
  };

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, t);
    } catch {
      // ignore
    }
  };

  // A data attribute on <html> so index.css's [data-app-theme="light"] rules (which cover the
  // app shell — body background, TopBar, Sidebar — and Simple mode's own components) can apply
  // without needing every element to read the theme value individually.
  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', theme);
  }, [theme]);

  return <ViewModeContext.Provider value={{ mode, setMode, theme, setTheme }}>{children}</ViewModeContext.Provider>;
};

export function useViewMode(): ViewModeContextValue {
  return useContext(ViewModeContext);
}

/**
 * Shared light/dark class tokens so ~30 components that were hardcoded dark can all move to a
 * single, consistent light palette instead of each inventing its own. Named after what each
 * token replaces (e.g. `cardBg` for what used to be a bare `bg-slate-900`), not what it looks
 * like, so call sites stay readable. Components with genuinely unique needs (a colored status
 * badge, a specific accent) still handle those inline — this only covers the structural
 * slate/white scaffolding repeated across almost every panel in this app.
 */
export interface ThemeTokens {
  light: boolean;
  pageBg: string;
  /** Primary card/panel surface — was a bare `bg-slate-900`. */
  cardBg: string;
  /** Slightly recessed surface nested inside a card — was `bg-slate-950` or `bg-slate-950/70-90`. */
  cardBgSunken: string;
  /** Muted/translucent grouping surface — was `bg-slate-900/30-60`. */
  cardBgMuted: string;
  /** Small pill/icon-chip background — was `bg-slate-800`. */
  chipBg: string;
  border: string;
  borderSubtle: string;
  hoverBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  hoverBg: string;
  hoverBgSubtle: string;
}

export function getThemeTokens(theme: AppTheme): ThemeTokens {
  const light = theme === 'light';
  return light
    ? {
        light: true,
        pageBg: 'bg-slate-50',
        cardBg: 'bg-white',
        cardBgSunken: 'bg-slate-50',
        cardBgMuted: 'bg-slate-50/80',
        chipBg: 'bg-slate-100',
        border: 'border-slate-200',
        borderSubtle: 'border-slate-200/70',
        hoverBorder: 'hover:border-slate-300',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-700',
        textMuted: 'text-slate-500',
        textFaint: 'text-slate-400',
        hoverBg: 'hover:bg-slate-100',
        hoverBgSubtle: 'hover:bg-slate-50',
      }
    : {
        light: false,
        pageBg: 'bg-[#070d14]',
        cardBg: 'bg-slate-900',
        cardBgSunken: 'bg-slate-950',
        cardBgMuted: 'bg-slate-900/40',
        chipBg: 'bg-slate-800',
        border: 'border-slate-800',
        borderSubtle: 'border-slate-800/60',
        hoverBorder: 'hover:border-slate-700',
        textPrimary: 'text-white',
        textSecondary: 'text-slate-300',
        textMuted: 'text-slate-400',
        textFaint: 'text-slate-500',
        hoverBg: 'hover:bg-slate-800',
        hoverBgSubtle: 'hover:bg-slate-900',
      };
}

export function useThemeTokens(): ThemeTokens {
  const { theme } = useViewMode();
  return getThemeTokens(theme);
}
