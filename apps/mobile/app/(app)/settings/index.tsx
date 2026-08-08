import { AppText as Text } from '@/components/ui/text';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { AppLanguage, ThemePreference } from '@/lib/settings-storage';

import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { getAccountFullLabel, getAccountType } from '@/lib/account';
import { useAuthGate } from '@/lib/auth-gate';
import { clearAuthSession } from '@/lib/auth-storage';
import { haptics } from '@/lib/haptics';
import { useOnboardingGate } from '@/lib/onboarding-gate';
import { hasPasscode } from '@/lib/passcode-storage';
import { resetFinoraSession } from '@/lib/reset-session';
import { useSettings } from '@/lib/settings-context';

function themeLabel(theme: ThemePreference): string {
  switch (theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
}

function languageLabel(language: AppLanguage): string {
  return language === 'fr' ? 'Français' : 'English';
}

function notificationsSummary(prefs: {
  approvals: boolean;
  payments: boolean;
  invoices: boolean;
  marketing: boolean;
}): string {
  const on = [prefs.approvals, prefs.payments, prefs.invoices, prefs.marketing].filter(
    Boolean,
  ).length;
  if (on === 0) return 'Off';
  if (on === 4) return 'All on';
  return `${on} on`;
}

export default function SettingsHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh } = useSettings();
  const { markSignedOut } = useAuthGate();
  const { markIncomplete } = useOnboardingGate();
  const [hasPin, setHasPin] = useState(false);
  const [accountType, setAccountTypeLocal] = useState(getAccountType());

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void hasPasscode().then(setHasPin);
      setAccountTypeLocal(getAccountType());
    }, [refresh]),
  );

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You’ll need to sign in again to use Finora.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          haptics.selection();
          await clearAuthSession();
          markSignedOut();
          haptics.success();
          router.replace('/auth' as Href);
        },
      },
    ]);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Finora',
      'Clears auth, onboarding, passcode, and local demo data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            haptics.selection();
            await resetFinoraSession();
            markSignedOut();
            markIncomplete();
            haptics.success();
            router.replace('/onboarding' as Href);
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.push('/settings/account' as Href);
          }}
          style={({ pressed }) => [styles.profile, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
            <Text style={[styles.avatarLetter, { color: colors.foreground }]}>
              {settings.displayName.trim().charAt(0).toUpperCase() || 'F'}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {settings.displayName}
            </Text>
            <Text
              style={[styles.profileEmail, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {settings.email}
            </Text>
            <Text style={[styles.profileType, { color: colors.mutedForeground }]}>
              {getAccountFullLabel(accountType)}
            </Text>
          </View>
          <Icon
            name='chevron-right'
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </SettingsSection>

      <SettingsSection title='App'>
        <SettingsRow
          label='Security'
          detail={hasPin ? 'Passcode on' : 'Passcode off'}
          icon='shield'
          showChevron
          onPress={() => router.push('/settings/security' as Href)}
        />
        <SettingsRow
          label='Memory'
          detail='What Finora remembers about you'
          icon='brain'
          showChevron
          onPress={() => router.push('/settings/memory' as Href)}
        />
        <SettingsRow
          label='Notifications'
          detail={notificationsSummary(settings.notifications)}
          icon='activity'
          showChevron
          onPress={() => router.push('/settings/notifications' as Href)}
        />
        <SettingsRow
          label='Appearance'
          detail={`${themeLabel(settings.theme)} · ${languageLabel(settings.language)}`}
          icon='eye'
          showChevron
          isLast
          onPress={() => router.push('/settings/appearance' as Href)}
        />
      </SettingsSection>

      <SettingsSection title='More'>
        <SettingsRow
          label='Integrations'
          detail='Gmail and connected tools'
          icon='integrations'
          showChevron
          onPress={() => router.push('/integrations' as Href)}
        />
        <SettingsRow
          label='Approvals'
          detail='Agent-prepared payments and plans'
          icon='shield'
          showChevron
          onPress={() => router.push('/approvals' as Href)}
        />
        <SettingsRow
          label='About Finora'
          detail={`v${Constants.expoConfig?.version ?? '0.1.0'}`}
          icon='info'
          showChevron
          isLast
          onPress={() => router.push('/settings/about' as Href)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label='Sign out'
          icon='arrow-up'
          destructive
          showChevron
          isLast
          onPress={handleSignOut}
        />
      </SettingsSection>

      {__DEV__ ? (
        <SettingsSection
          title='Developer'
          footer='Only visible in development builds.'
        >
          <SettingsRow
            label='Reset Finora data'
            detail='Auth, onboarding, passcode, local mocks'
            icon='reload'
            destructive
            showChevron
            isLast
            onPress={handleReset}
          />
        </SettingsSection>
      ) : null}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 23,
    fontWeight: '600',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
  profileType: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});
