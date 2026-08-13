import { StyleSheet, View } from 'react-native';

import type { AppLanguage, ThemePreference } from '@/lib/settings-storage';

import {
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/lib/settings-context';

export default function AppearanceSettingsScreen() {
  const { colors } = useTheme();
  const { settings, loading, update, setTheme, setLanguage, setLargerText, t } = useSettings();

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection
        title={t('settings_theme')}
        footer={t('settings_theme_follows')}
      >
        <View style={styles.segmentPad}>
          <SettingsSegmented
            value={settings.theme}
            onChange={(id) => void setTheme(id as ThemePreference)}
            options={[
              { id: 'system', label: t('settings_theme_system') },
              { id: 'light', label: t('settings_theme_light') },
              { id: 'dark', label: t('settings_theme_dark') },
            ]}
          />
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings_language')}>
        <View style={styles.segmentPad}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t('settings_lang_hint')}
          </Text>
          <SettingsSegmented
            value={settings.language}
            onChange={(id) => void setLanguage(id as AppLanguage)}
            options={[
              { id: 'en', label: t('settings_lang_en') },
              { id: 'fr', label: t('settings_lang_fr') },
            ]}
          />
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings_accessibility')}>
        <SettingsSwitchRow
          label={t('settings_larger_text')}
          detail={t('settings_larger_text_detail')}
          icon='eye'
          value={settings.largerText}
          onValueChange={(value) => void setLargerText(value)}
          isLast
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsSwitchRow
          label={t('settings_haptics')}
          detail={t('settings_haptics_sub')}
          icon='activity'
          value={settings.hapticsEnabled}
          onValueChange={(v) => void update({ hapticsEnabled: v })}
          isLast
        />
      </SettingsSection>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  segmentPad: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});
