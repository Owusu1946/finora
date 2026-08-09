import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  subscribeSettings,
  type AppLanguage,
  type FinoraSettings,
  type ThemePreference,
} from './settings-storage';

type SettingsContextValue = {
  settings: FinoraSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  update: (patch: Partial<FinoraSettings>) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setLargerText: (largerText: boolean) => Promise<void>;
  isDark: boolean;
  colors: Palette;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [settings, setSettings] = useState<FinoraSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getSettings();
    setSettings(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeSettings(() => {
      void refresh();
    });
  }, [refresh]);

  const update = useCallback(async (patch: Partial<FinoraSettings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
  }, []);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await update({ theme });
    },
    [update],
  );

  const setLanguage = useCallback(
    async (language: AppLanguage) => {
      await update({ language });
    },
    [update],
  );

  const setLargerText = useCallback(
    async (largerText: boolean) => {
      await update({ largerText });
    },
    [update],
  );

  const isDark = useMemo(() => {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    return systemScheme === 'dark';
  }, [settings.theme, systemScheme]);

  const colors = isDark ? Colors.dark : Colors.light;

  const value = useMemo(
    () => ({
      settings,
      loading,
      refresh,
      update,
      setTheme,
      setLanguage,
      setLargerText,
      isDark,
      colors,
    }),
    [settings, loading, refresh, update, setTheme, setLanguage, setLargerText, isDark, colors],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
