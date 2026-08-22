import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';

import { useSettings } from '@/lib/settings-context';

export type BiometricMethod = 'face' | 'fingerprint';

export type BiometricUnlockStatus = 'success' | 'canceled' | 'failed' | 'unavailable';

/**
 * Reads the current device and app-settings state to decide whether the
 * biometric shortcut should be shown. Call `authenticate` from a user action.
 */
export function useBiometricUnlock() {
  const { settings } = useSettings();
  const [isAvailable, setIsAvailable] = useState(false);
  const [method, setMethod] = useState<BiometricMethod>('fingerprint');

  useEffect(() => {
    let active = true;

    const loadMethod = async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (active && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setMethod('face');
        }
      } catch {
        // The fingerprint default is safe on unsupported platforms.
      }
    };

    void loadMethod();
    return () => {
      active = false;
    };
  }, []);

  const checkAvailability = useCallback(async () => {
    if (!settings.biometricsEnabled) return false;

    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }, [settings.biometricsEnabled]);

  useEffect(() => {
    let active = true;

    void checkAvailability().then((available) => {
      if (active) setIsAvailable(available);
    });

    return () => {
      active = false;
    };
  }, [checkAvailability]);

  const authenticate = useCallback(
    async (promptMessage: string): Promise<BiometricUnlockStatus> => {
      const isAvailable = await checkAvailability();
      if (!isAvailable) return 'unavailable';

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          disableDeviceFallback: true,
          fallbackLabel: '',
        });

        if (result.success) return 'success';
        return result.error === 'user_cancel' || result.error === 'system_cancel'
          ? 'canceled'
          : 'failed';
      } catch {
        return 'failed';
      }
    },
    [checkAvailability],
  );

  return { authenticate, isAvailable, method };
}
