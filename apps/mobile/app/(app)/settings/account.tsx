import { useClerk, useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

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
import { useSettings } from '@/lib/settings-context';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, loading, refresh, t } = useSettings();
  const { signOut } = useClerk();
  const { user } = useUser();
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
          <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
            {user?.imageUrl ? (
              <Image
                source={user.imageUrl}
                style={styles.avatarImage}
                contentFit='cover'
                transition={150}
              />
            ) : (
              <Text style={[styles.avatarLetter, { color: colors.foreground }]}>
                {settings.displayName.trim().charAt(0).toUpperCase() || 'F'}
              </Text>
            )}
          </View>
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
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
