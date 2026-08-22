import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';

import { useSettings } from '@/lib/settings-context';

export type BiometricMethod = 'face' | 'fingerprint';

export type BiometricAvailability = {
  available: boolean;
  method: BiometricMethod;
};

export type BiometricUnlockStatus = 'success' | 'canceled' | 'failed' | 'unavailable';

/** Reads current device and app-settings state for the biometric shortcut. */
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

/**
 * Confirms biometric enrollment with a device prompt before Finora enables
 * the unlock shortcut.
 */
export async function confirmBiometricEnable(): Promise<
  { confirmed: true } | { confirmed: false; reason: 'unavailable' | 'failed' | 'canceled' }
> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    if (!hasHardware || !isEnrolled) {
      return { confirmed: false, reason: 'unavailable' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric unlock for Finora',
      disableDeviceFallback: true,
      fallbackLabel: '',
    });

    if (result.success) return { confirmed: true };
    return {
      confirmed: false,
      reason:
        result.error === 'user_cancel' || result.error === 'system_cancel' ? 'canceled' : 'failed',
    };
  } catch {
    return { confirmed: false, reason: 'failed' };
  }
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
      available: hasHardware && isEnrolled,
      method: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'face'
        : 'fingerprint',
    };
  } catch {
    return { available: false, method: 'fingerprint' };
  }
}
