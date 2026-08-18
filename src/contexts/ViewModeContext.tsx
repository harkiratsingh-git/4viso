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
