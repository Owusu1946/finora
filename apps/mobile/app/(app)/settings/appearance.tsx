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
  const { settings, loading, update, setTheme, setLanguage, setLargerText } = useSettings();

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection
        title='Theme'
        footer='System follows your device appearance.'
      >
        <View style={styles.segmentPad}>
          <SettingsSegmented
            value={settings.theme}
            onChange={(id) => void setTheme(id as ThemePreference)}
            options={[
              { id: 'system', label: 'System' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
          />
        </View>
      </SettingsSection>

      <SettingsSection title='Language'>
        <View style={styles.segmentPad}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Applies to Finora copy. Chat replies follow the model language.
          </Text>
          <SettingsSegmented
            value={settings.language}
            onChange={(id) => void setLanguage(id as AppLanguage)}
            options={[
              { id: 'en', label: 'English' },
              { id: 'fr', label: 'Français' },
            ]}
          />
        </View>
      </SettingsSection>

      <SettingsSection title='Accessibility'>
        <SettingsSwitchRow
          label='Larger text'
          detail='Increase text across Finora by 2px'
          icon='eye'
          value={settings.largerText}
          onValueChange={(value) => void setLargerText(value)}
          isLast
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsSwitchRow
          label='Haptics'
          detail='Vibration feedback on taps and confirms'
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
