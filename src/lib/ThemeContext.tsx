import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/* ─── Types ─── */

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Resolved theme ('light' | 'dark') that is actually applied */
  resolvedTheme: 'light' | 'dark';
  /** User's stored preference */
  mode: ThemeMode;
  /** Set user's preference */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light ↔ dark (ignores 'system') */
  toggle: () => void;
}

/* ─── Context ─── */

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/* ─── Constants ─── */

const STORAGE_KEY = 'bandwith-theme-mode';

/* ─── Helpers ─── */

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return 'system';
}

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemPreference();
  return mode;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/* ─── Provider ─── */

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getStoredMode()));

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setMode]);

  // Apply the resolved theme whenever it changes
  useEffect(() => {
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [mode]);

  // Listen for system preference changes (affects 'system' mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (mode === 'system') {
        const resolved = getSystemPreference();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ resolvedTheme, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

/* ─── Hook ─── */

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
