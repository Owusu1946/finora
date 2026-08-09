import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.auth.session';
const TAG_CONFIGURED_KEY = 'finora.auth.tagConfigured';

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
  await removeItem(TAG_CONFIGURED_KEY);
}

export async function getTagConfigured(): Promise<boolean> {
  const value = await getItem(TAG_CONFIGURED_KEY);
  return value === '1';
}

export async function setTagConfigured(): Promise<void> {
  await setItem(TAG_CONFIGURED_KEY, '1');
}

export async function clearTagConfigured(): Promise<void> {
  await removeItem(TAG_CONFIGURED_KEY);
}
