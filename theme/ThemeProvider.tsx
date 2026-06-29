import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, Theme, ThemeMode } from './themes';

const STORAGE_KEY = '@jissi/theme-mode';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? (system === 'light' ? 'light' : 'dark'));

  // Restore the user's persisted preference once on mount.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (active && (v === 'light' || v === 'dark')) setModeState(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: mode === 'dark' ? darkTheme : lightTheme, mode, setMode, toggle }),
    [mode, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Active theme. Falls back to `darkTheme` if used outside a ThemeProvider so the
 * design-system components render safely during the phased migration (the
 * provider is wired into the app in the screen-redesign phase).
 */
export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? darkTheme;
}

export function useThemeMode(): { mode: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void } {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { mode: 'dark', setMode: () => {}, toggle: () => {} };
  }
  return { mode: ctx.mode, setMode: ctx.setMode, toggle: ctx.toggle };
}
