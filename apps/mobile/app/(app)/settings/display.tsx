import { Pressable, View } from 'react-native';

import type { AppLanguage, ThemePreference } from '@/lib/settings-storage';

import {
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { ThemePreview } from '@/components/settings/theme-preview';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { useSettings } from '@/lib/settings-context';

export default function AppearanceSettingsScreen() {
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
        <View className='gap-2.5 px-3.5 py-3.5'>
          <Text className='font-sans-medium text-sm leading-[18px] text-muted-foreground'>
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
        <View className='flex-row flex-wrap items-start gap-4 px-3.5 py-3.5'>
          {themeOptions.map((option) => {
            const selected = settings.theme === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole='radio'
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                className={cx(
                  'items-center gap-2 overflow-hidden rounded-[14px] border-2 border-transparent p-1',
                  selected && 'border-primary',
                )}
                onPress={() => {
                  void setTheme(option.id);
                }}
              >
                <ThemePreview
                  mode={option.id}
                  width={88}
                />
                <View className='items-center'>
                  <Text
                    className={cx(
                      'font-sans-medium text-[13px]',
                      selected ? 'text-foreground' : 'text-muted-foreground',
                    )}
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
