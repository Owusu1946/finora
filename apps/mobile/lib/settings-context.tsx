import { VariableContextProvider, vars } from 'nativewind';
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

import { t, type TranslationKey } from './i18n';
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
  update: (patch: Partial<FinoraSettings>) => Promise<FinoraSettings>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setLargerText: (largerText: boolean) => Promise<void>;
  isDark: boolean;
  colors: Palette;
  t: (key: TranslationKey) => string;
};

const themeVariables = (colors: Palette) =>
  vars({
    '--color-theme-background': colors.background,
    '--color-theme-foreground': colors.foreground,
    '--color-theme-card': colors.card,
    '--color-theme-card-foreground': colors.cardForeground,
    '--color-theme-muted': colors.muted,
    '--color-theme-muted-foreground': colors.mutedForeground,
    '--color-theme-accent': colors.accent,
    '--color-theme-border': colors.border,
    '--color-theme-primary': colors.primary,
    '--color-theme-primary-foreground': colors.primaryForeground,
    '--color-theme-composer': colors.composer,
    '--color-theme-destructive': colors.destructive,
    '--color-theme-destructive-foreground': colors.destructiveForeground,
    '--color-theme-destructive-surface': colors.destructiveSurface,
    '--color-theme-ring': colors.ring,
  });

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
    return next;
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

  const translate = useCallback(
    (key: TranslationKey) => t(key, settings.language),
    [settings.language],
  );

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
      t: translate,
    }),
    [
      settings,
      loading,
      refresh,
      update,
      setTheme,
      setLanguage,
      setLargerText,
      isDark,
      colors,
      translate,
    ],
  );

  return (
    <VariableContextProvider value={themeVariables(colors)}>
      <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
    </VariableContextProvider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
