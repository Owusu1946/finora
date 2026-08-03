import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAccountType } from '@/lib/account';

const KEYS = [
  'finora.auth.session',
  'finora.onboarding.completed',
  'finora.accountType',
] as const;

/** Clears auth + onboarding persistence (and resets in-memory account type). */
export async function resetFinoraSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...KEYS]);
  } catch {
    // Native module may be unavailable; in-memory maps in storage helpers won't clear
    // across modules, but next boot with working AsyncStorage will read empty.
  }
  setAccountType('personal');
}
