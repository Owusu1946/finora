import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native';

import type { AppLanguage, ThemePreference } from '@/lib/settings-storage';

import {
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { ThemePreview } from '@/components/settings/theme-preview';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/lib/settings-context';

export default function AppearanceSettingsScreen() {
  const { colors } = useTheme();
  const { settings, loading, update, setTheme, setLanguage, setLargerText, t } = useSettings();

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
  }> = [
    { id: 'system', label: t('settings_theme_system') },
    { id: 'light', label: t('settings_theme_light') },
    { id: 'dark', label: t('settings_theme_dark') },
  ];

  return (
    <SettingsScreen loading={loading}>
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

      <SettingsSection
        title={t('settings_theme')}
        footer={t('settings_theme_follows')}
      >
        <View style={styles.previewRow}>
          {themeOptions.map((option) => {
            const selected = settings.theme === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole='radio'
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={[styles.previewOption, selected && { borderColor: colors.primary }]}
                onPress={() => {
                  void setTheme(option.id);
                }}
              >
                <ThemePreview
                  mode={option.id}
                  width={88}
                />
                <View style={styles.previewLabel}>
                  <Text
                    style={[
                      styles.previewText,
                      { color: selected ? colors.foreground : colors.mutedForeground },
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
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
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewOption: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 4,
    overflow: 'hidden',
  },
  previewLabel: {
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
    fontWeight: '500',
  },
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
