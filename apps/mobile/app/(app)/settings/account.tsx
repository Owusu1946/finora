import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { UserAvatar } from '@/components/profile/UserAvatar';
import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSegmented,
} from '@/components/settings/SettingsPrimitives';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, setAccountType } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { completeOnboarding } from '@/lib/onboarding-storage';
import { updateUserProfile } from '@/lib/profile-api';
import { useSettings } from '@/lib/settings-context';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh, t } = useSettings();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [accountType, setAccountTypeLocal] = useState(getAccountType());

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setAccountTypeLocal(getAccountType());
    }, [refresh]),
  );

  const handleAccountType = async (type: 'personal' | 'business') => {
    const previousType = accountType;
    if (type === previousType) return;

    setAccountType(type);
    setAccountTypeLocal(type);
    try {
      await updateUserProfile(getToken, { accountType: type });
      await completeOnboarding(type);
      haptics.selection();
    } catch {
      setAccountType(previousType);
      setAccountTypeLocal(previousType);
      haptics.impact();
      Alert.alert('Could not update account type', 'Check your connection and try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('settings_sign_out'), t('settings_sign_out_confirm'), [
      { text: t('action_cancel'), style: 'cancel' },
      {
        text: t('settings_sign_out'),
        style: 'destructive',
        onPress: async () => {
          haptics.selection();
          await signOut();
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
          <UserAvatar
            accountType={accountType}
            backgroundColor={colors.muted}
            displayName={settings.displayName}
            foregroundColor={colors.foreground}
            imageUrl={user?.imageUrl}
            seed={user?.id ?? settings.email}
            size={52}
          />
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {settings.displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              @{settings.finoraTag} · {settings.email}
            </Text>
          </View>
        </View>
      </SettingsSection>

      <SettingsSection
        title={t('account_type_title')}
        footer={t('account_type_footer')}
      >
        <View style={styles.segmentPad}>
          <SettingsSegmented
            value={accountType}
            onChange={(id) => void handleAccountType(id as 'personal' | 'business')}
            options={[
              { id: 'personal', label: t('account_type_personal') },
              { id: 'business', label: t('account_type_business') },
            ]}
          />
        </View>
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label={t('settings_sign_out')}
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
  segmentPad: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
