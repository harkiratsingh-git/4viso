import React, { createContext, useContext, useEffect, useState } from 'react';
import { PortEntry, LOCAL_PORTS_FALLBACK, mergePortsDirectories } from '../utils/ports';
import { fetchPortsFromSupabase } from '../services/supabaseService';

interface PortsContextValue {
  ports: PortEntry[];
  isLive: boolean;
}

const PortsContext = createContext<PortsContextValue>({ ports: LOCAL_PORTS_FALLBACK, isLive: false });

export const PortsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<PortsContextValue>({ ports: LOCAL_PORTS_FALLBACK, isLive: false });

  useEffect(() => {
    let cancelled = false;
    fetchPortsFromSupabase()
      .then((live) => {
        if (cancelled || !live || live.length === 0) return;
        setValue({ ports: mergePortsDirectories(live), isLive: true });
      })
      .catch((err) => console.warn('Failed to load ports directory from Supabase:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return <PortsContext.Provider value={value}>{children}</PortsContext.Provider>;
};

export function usePorts(): PortsContextValue {
  return useContext(PortsContext);
}
