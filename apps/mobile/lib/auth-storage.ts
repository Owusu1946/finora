import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG_CONFIGURED_KEY = 'finora.auth.tagConfigured';
const TAG_CONFIGURED_USER_KEY = 'finora.auth.tagConfiguredUserId';

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

export async function getTagConfigured(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  const [value, configuredUserId] = await Promise.all([
    getItem(TAG_CONFIGURED_KEY),
    getItem(TAG_CONFIGURED_USER_KEY),
  ]);
  return value === '1' && configuredUserId === userId;
}

export async function setTagConfigured(userId: string): Promise<void> {
  await Promise.all([setItem(TAG_CONFIGURED_KEY, '1'), setItem(TAG_CONFIGURED_USER_KEY, userId)]);
}

export async function clearTagConfigured(): Promise<void> {
  await Promise.all([removeItem(TAG_CONFIGURED_KEY), removeItem(TAG_CONFIGURED_USER_KEY)]);
}
