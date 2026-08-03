import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.integrations.v1';

export type IntegrationsState = {
  gmailConnected: boolean;
  gmailEmail?: string;
  connectedAt?: string;
};

const DEFAULT: IntegrationsState = { gmailConnected: false };

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
    // memory fallback
  }
}

export async function getIntegrations(): Promise<IntegrationsState> {
  const raw = await getItem(KEY);
  if (!raw) return { ...DEFAULT };
  try {
    return { ...DEFAULT, ...(JSON.parse(raw) as IntegrationsState) };
  } catch {
    return { ...DEFAULT };
  }
}

export async function connectGmail(email = 'kenneth@finora.business'): Promise<IntegrationsState> {
  const next: IntegrationsState = {
    gmailConnected: true,
    gmailEmail: email,
    connectedAt: new Date().toISOString(),
  };
  await setItem(KEY, JSON.stringify(next));
  return next;
}

export async function disconnectGmail(): Promise<IntegrationsState> {
  const next: IntegrationsState = { gmailConnected: false };
  await setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearIntegrations(): Promise<void> {
  memory.delete(KEY);
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
