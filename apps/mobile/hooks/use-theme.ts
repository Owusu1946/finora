import { useSettings } from '@/lib/settings-context';

/** Theme colors from Settings → Appearance (system / light / dark). */
export function useTheme() {
  const { isDark, colors } = useSettings();
  return { isDark, colors };
}
