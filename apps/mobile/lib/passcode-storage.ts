import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.passcode.hash';
export const PASSCODE_LENGTH = 6;

const memory = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Still valid for this process via memory.
  }
}

async function removeItem(key: string): Promise<void> {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Lightweight hash for mock storage — replace with SecureStore + proper KDF later. */
function hashPasscode(passcode: string): string {
  let h = 2166136261;
  const salted = `finora.passcode.v1:${passcode}`;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export async function hasPasscode(): Promise<boolean> {
  const value = await getItem(KEY);
  return Boolean(value);
}

export async function setPasscode(passcode: string): Promise<void> {
  if (!/^\d+$/.test(passcode) || passcode.length !== PASSCODE_LENGTH) {
    throw new Error(`Passcode must be ${PASSCODE_LENGTH} digits.`);
  }
  await setItem(KEY, hashPasscode(passcode));
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const stored = await getItem(KEY);
  if (!stored) return false;
  return stored === hashPasscode(passcode);
}

export async function clearPasscode(): Promise<void> {
  await removeItem(KEY);
}
