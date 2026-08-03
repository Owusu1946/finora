import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.auth.session';

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
    // Session still valid for this process via memory.
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

export async function getAuthSession(): Promise<boolean> {
  const value = await getItem(KEY);
  return value === '1';
}

export async function setAuthSession(): Promise<void> {
  await setItem(KEY, '1');
}

export async function clearAuthSession(): Promise<void> {
  await removeItem(KEY);
}
