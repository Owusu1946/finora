import { useTrustedDevices, type TrustedDevice } from '@clerk/expo';
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

function trustedDeviceName(device: TrustedDevice, currentDeviceId: string | null) {
  if (device.id === currentDeviceId) return 'This device';
  return device.name || `${device.platform === 'unknown' ? 'Other' : device.platform} device`;
}

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ changePasscode?: string }>();
  const { settings, loading, update, refresh, t } = useSettings();
  const { requestChange, modal: passcodeModal } = useChangePasscode();
  const [hasPin, setHasPin] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState<'face' | 'fingerprint'>('fingerprint');
  const trustedDevicesApi = useTrustedDevices();
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(true);
  const [trustedDevicesError, setTrustedDevicesError] = useState<string | null>(null);
  const [trustedDeviceAvailable, setTrustedDeviceAvailable] = useState<boolean | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
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
      let active = true;
      setTrustedDevicesLoading(true);
      setTrustedDevicesError(null);
      void Promise.all([trustedDevicesApi.getAvailability(), trustedDevicesApi.list()])
        .then(([availability, devices]) => {
          if (!active) return;
          setTrustedDeviceAvailable(availability.isAvailable);
          setTrustedDevices(devices.filter((device) => device.status === 'active'));
          setCurrentDeviceId(devices.find((device) => device.name === 'This device')?.id ?? null);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setTrustedDeviceAvailable(null);
          setTrustedDevicesError(error instanceof Error ? error.message : 'Could not load trusted devices.');
        })
        .finally(() => {
          if (active) setTrustedDevicesLoading(false);
        });
      return () => {
        active = false;
      };
    }, [refresh, trustedDevicesApi]),
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

  const handleEnrollDevice = async () => {
    if (enrolling) return;
    setEnrolling(true);
    try {
      await trustedDevicesApi.enroll({
        deviceName: 'This device',
        reason: 'Enable trusted device sign-in for Finora',
        policy: 'biometry_or_device_passcode',
      });
      const devices = await trustedDevicesApi.list();
      setTrustedDevices(devices.filter((device) => device.status === 'active'));
      setTrustedDeviceAvailable(true);
      haptics.success();
    } catch (error: unknown) {
      Alert.alert('Trusted device', error instanceof Error ? error.message : 'Could not trust this device.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRevokeDevice = (id: string, name: string) => {
    Alert.alert(t('sec_revoke_title'), `${t('sec_revoke_confirm')} (${name})`, [
      { text: t('action_cancel'), style: 'cancel' },
      {
        text: t('action_done'),
        style: 'destructive',
        onPress: async () => {
          try {
            await trustedDevicesApi.revoke(id);
            setTrustedDevices((current) => current.filter((device) => device.id !== id));
            haptics.success();
          } catch (error: unknown) {
            Alert.alert(t('sec_revoke_title'), error instanceof Error ? error.message : 'Could not revoke device.');
          }
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
          {trustedDevicesLoading ? (
            <SettingsRow
              label='Loading trusted devices'
              detail='Checking your secure devices…'
              icon='shield'
              isLast
            />
          ) : trustedDeviceAvailable === false ? (
            <SettingsRow
              label='Trusted devices unavailable'
              detail='Use a native development build with supported biometrics and Clerk trusted devices enabled.'
              icon='shield'
              isLast
            />
          ) : trustedDevicesError ? (
            <SettingsRow
              label='Could not load trusted devices'
              detail={trustedDevicesError}
              icon='shield'
              isLast
              showChevron
              onPress={() => {
                setTrustedDevicesLoading(true);
                setTrustedDevicesError(null);
                void trustedDevicesApi.list()
                  .then((devices) => setTrustedDevices(devices.filter((device) => device.status === 'active')))
                  .catch((error: unknown) => setTrustedDevicesError(error instanceof Error ? error.message : 'Could not load trusted devices.'))
                  .finally(() => setTrustedDevicesLoading(false));
              }}
            />
          ) : (
            <>
              {trustedDevices.map((device, index) => {
                const isCurrent = device.id === currentDeviceId;
                return (
                  <SettingsRow
                    key={device.id}
                    label={trustedDeviceName(device, currentDeviceId)}
                    detail={`${device.platform} · Last active ${relativeTime((device.lastUsedAt ?? device.updatedAt).toISOString())}`}
                    icon='phone'
                    isLast={index === trustedDevices.length - 1}
                    showChevron={!isCurrent}
                    onPress={isCurrent ? undefined : () => handleRevokeDevice(device.id, trustedDeviceName(device, currentDeviceId))}
                    right={isCurrent ? <Text className='font-sans-semibold text-[13px] text-muted-foreground'>{t('sec_current')}</Text> : undefined}
                  />
                );
              })}
              <SettingsRow
                label={enrolling ? 'Trusting this device…' : 'Trust this device'}
                detail='Use Face ID, Touch ID, or your device passcode.'
                icon='shield'
                isLast
                disabled={enrolling}
                showChevron={!enrolling}
                onPress={enrolling ? undefined : () => void handleEnrollDevice()}
              />
            </>
          )}
        </SettingsSection>
      </SettingsScreen>
      {passcodeModal}
    </>
  );
}
