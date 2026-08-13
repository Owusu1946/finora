import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';

import { useChangePasscode } from '@/components/passcode/use-change-passcode';
import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { hasPasscode } from '@/lib/passcode-storage';
import { useSettings } from '@/lib/settings-context';
import { revokeTrustedDevice } from '@/lib/settings-storage';

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ changePasscode?: string }>();
  const { colors } = useTheme();
  const { settings, loading, update, refresh } = useSettings();
  const { requestChange, modal: passcodeModal } = useChangePasscode();
  const [hasPin, setHasPin] = useState(false);
  const resumedChangeRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void hasPasscode().then(setHasPin);
    }, [refresh]),
  );

  const handleChangePasscode = useCallback(async () => {
    const ok = await requestChange();
    if (ok) {
      setHasPin(true);
      Alert.alert('Passcode updated', 'Use your new passcode to approve money moves.');
    }
  }, [requestChange]);

  useEffect(() => {
    if (params.changePasscode !== '1' || resumedChangeRef.current) return;
    resumedChangeRef.current = true;
    router.setParams({ changePasscode: undefined });
    void handleChangePasscode();
  }, [handleChangePasscode, params.changePasscode, router]);

  const handleBiometrics = async (next: boolean) => {
    await update({ biometricsEnabled: next });
    if (next) {
      Alert.alert(
        'Biometrics',
        'Face ID / fingerprint will unlock Approvals once device auth is wired. The toggle is saved for now.',
      );
    }
  };

  const handleRevokeDevice = (id: string, name: string) => {
    Alert.alert('Revoke device', `Remove “${name}” from trusted devices?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await revokeTrustedDevice(id);
          await refresh();
          haptics.success();
        },
      },
    ]);
  };

  return (
    <>
      <SettingsScreen
        loading={loading}
        contentStyle={styles.content}
      >
        <SettingsSection footer='Passcode and biometrics gate Approvals before money moves.'>
          <SettingsRow
            label={hasPin ? 'Change passcode' : 'Create passcode'}
            detail={hasPin ? 'Used to approve payments and plans' : 'Required before first send'}
            icon='shield'
            showChevron
            onPress={() => void handleChangePasscode()}
          />
          <SettingsSwitchRow
            label='Biometrics'
            detail={
              Platform.OS === 'ios'
                ? 'Face ID / Touch ID (coming soon)'
                : 'Fingerprint (coming soon)'
            }
            icon='biometric'
            value={settings.biometricsEnabled}
            onValueChange={(v) => void handleBiometrics(v)}
            isLast
          />
        </SettingsSection>

        <SettingsSection
          title='Trusted devices'
          footer='Revoke a device to require sign-in again on that device.'
        >
          {settings.trustedDevices.map((device, index) => (
            <SettingsRow
              key={device.id}
              label={device.name}
              detail={
                device.current
                  ? `This device · Active ${relativeTime(device.lastActiveAt)}`
                  : `${device.platform} · Last active ${relativeTime(device.lastActiveAt)}`
              }
              icon={device.platform === 'web' ? 'integrations' : 'phone'}
              isLast={index === settings.trustedDevices.length - 1}
              showChevron={!device.current}
              onPress={
                device.current ? undefined : () => handleRevokeDevice(device.id, device.name)
              }
              right={
                device.current ? (
                  <Text style={[styles.currentPill, { color: colors.mutedForeground }]}>
                    Current
                  </Text>
                ) : undefined
              }
            />
          ))}
        </SettingsSection>
      </SettingsScreen>
      {passcodeModal}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
  },
  currentPill: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
});
