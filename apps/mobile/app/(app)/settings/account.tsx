import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
} from '@/components/settings/SettingsPrimitives';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, setAccountType } from '@/lib/account';
import { useAuthGate } from '@/lib/auth-gate';
import { clearAuthSession } from '@/lib/auth-storage';
import { haptics } from '@/lib/haptics';
import { completeOnboarding } from '@/lib/onboarding-storage';
import { useSettings } from '@/lib/settings-context';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh } = useSettings();
  const { markSignedOut } = useAuthGate();
  const [accountType, setAccountTypeLocal] = useState(getAccountType());

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setAccountTypeLocal(getAccountType());
    }, [refresh]),
  );

  const handleAccountType = async (type: 'personal' | 'business') => {
    setAccountType(type);
    setAccountTypeLocal(type);
    await completeOnboarding(type);
    haptics.selection();
  };

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

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
            <Text style={[styles.avatarLetter, { color: colors.foreground }]}>
              {settings.displayName.trim().charAt(0).toUpperCase() || 'F'}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {settings.displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {settings.email}
            </Text>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection
        title='Account type'
        footer='Personal or business changes how Finora labels wallets and plans.'
      >
        <View style={styles.segmentPad}>
          <SettingsSegmented
            value={accountType}
            onChange={(id) => void handleAccountType(id as 'personal' | 'business')}
            options={[
              { id: 'personal', label: 'Personal' },
              { id: 'business', label: 'Business' },
            ]}
          />
        </View>
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
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
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
    fontSize: 22,
    fontWeight: '600',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentPad: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
