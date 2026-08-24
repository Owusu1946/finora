import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useChangePasscode } from '@/components/passcode/use-change-passcode';
import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { AppText as Text } from '@/components/ui/text';
import { confirmBiometricEnable, getBiometricAvailability } from '@/lib/biometrics';
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
  const { settings, loading, update, refresh, t } = useSettings();
  const { requestChange, modal: passcodeModal } = useChangePasscode();
  const [hasPin, setHasPin] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState<'face' | 'fingerprint'>('fingerprint');
  const resumedChangeRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void Promise.all([hasPasscode(), getBiometricAvailability()]).then(
        ([passcodeExists, biometrics]) => {
          setHasPin(passcodeExists);
          setBiometricMethod(biometrics.method);
        },
      );
    }, [refresh]),
  );

  const handleChangePasscode = useCallback(async () => {
    const ok = await requestChange();
    if (ok) {
      setHasPin(true);
      Alert.alert(t('sec_passcode_updated_title'), t('sec_passcode_updated_sub'));
    }
  }, [requestChange, t]);

  useEffect(() => {
    if (params.changePasscode !== '1' || resumedChangeRef.current) return;
    resumedChangeRef.current = true;
    router.setParams({ changePasscode: undefined });
    void handleChangePasscode();
  }, [handleChangePasscode, params.changePasscode, router]);

  const handleBiometrics = async (next: boolean) => {
    if (!next) {
      await update({ biometricsEnabled: false });
      return true;
    }

    const confirmation = await confirmBiometricEnable();
    if (!confirmation.confirmed) {
      Alert.alert(t('sec_biometrics'), t('sec_biometrics_enable_failed'));
      return false;
    }

    await update({ biometricsEnabled: true });
    haptics.success();
    return true;
  };

  const handleRevokeDevice = (id: string, name: string) => {
    Alert.alert(t('sec_revoke_title'), `${t('sec_revoke_confirm')} (${name})`, [
      { text: t('action_cancel'), style: 'cancel' },
      {
        text: t('action_done'),
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
        contentStyle={{ gap: 22 }}
      >
        <SettingsSection footer={t('sec_footer_passcode')}>
          <SettingsRow
            label={hasPin ? t('sec_change_passcode') : t('sec_create_passcode')}
            detail={hasPin ? t('sec_passcode_detail_has') : t('sec_passcode_detail_none')}
            icon='shield'
            showChevron
            onPress={() => void handleChangePasscode()}
          />
          <SettingsSwitchRow
            label={t('sec_biometrics')}
            detail={t('sec_biometrics_detail')}
            icon={biometricMethod === 'face' ? 'face-id' : 'biometric'}
            value={settings.biometricsEnabled}
            onValueChange={handleBiometrics}
            isLast
          />
        </SettingsSection>

        <SettingsSection
          title={t('sec_trusted_devices')}
          footer={t('sec_trusted_footer')}
        >
          {settings.trustedDevices.map((device, index) => (
            <SettingsRow
              key={device.id}
              label={device.name}
              detail={
                device.current
                  ? `${t('sec_this_device')} \u00b7 Active ${relativeTime(device.lastActiveAt)}`
                  : `${device.platform} \u00b7 Last active ${relativeTime(device.lastActiveAt)}`
              }
              icon={device.platform === 'web' ? 'integrations' : 'phone'}
              isLast={index === settings.trustedDevices.length - 1}
              showChevron={!device.current}
              onPress={
                device.current ? undefined : () => handleRevokeDevice(device.id, device.name)
              }
              right={
                device.current ? (
                  <Text className='font-sans-semibold text-[13px] text-muted-foreground'>
                    {t('sec_current')}
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
