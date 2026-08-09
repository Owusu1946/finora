import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.integrations.v1';

export type IntegrationsState = {
  gmailConnected: boolean;
  gmailEmail?: string;
  gmailConnectedAt?: string;
  /** @deprecated Prefer gmailConnectedAt — kept for older persisted state. */
  connectedAt?: string;
  calendarConnected: boolean;
  calendarEmail?: string;
  calendarConnectedAt?: string;
  smsConnected: boolean;
  smsPhone?: string;
  smsConnectedAt?: string;
};

const DEFAULT: IntegrationsState = {
  gmailConnected: false,
  calendarConnected: false,
  smsConnected: false,
};

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

async function readState(): Promise<IntegrationsState> {
  const raw = await getItem(KEY);
  if (!raw) return { ...DEFAULT };
  try {
    const parsed = JSON.parse(raw) as Partial<IntegrationsState>;
    return {
      ...DEFAULT,
      ...parsed,
      gmailConnectedAt: parsed.gmailConnectedAt ?? parsed.connectedAt,
    };
  } catch {
    return { ...DEFAULT };
  }
}

async function writeState(next: IntegrationsState): Promise<IntegrationsState> {
  await setItem(KEY, JSON.stringify(next));
  return next;
}

export async function getIntegrations(): Promise<IntegrationsState> {
  return readState();
}

export async function connectGmail(email = 'kenneth@finora.business'): Promise<IntegrationsState> {
  const current = await readState();
  const now = new Date().toISOString();
  return writeState({
    ...current,
    gmailConnected: true,
    gmailEmail: email,
    gmailConnectedAt: now,
    connectedAt: now,
  });
}

export async function disconnectGmail(): Promise<IntegrationsState> {
  const current = await readState();
  return writeState({
    ...current,
    gmailConnected: false,
    gmailEmail: undefined,
    gmailConnectedAt: undefined,
    connectedAt: undefined,
  });
}

export async function connectGoogleCalendar(
  email = 'kenneth@finora.business',
): Promise<IntegrationsState> {
  const current = await readState();
  return writeState({
    ...current,
    calendarConnected: true,
    calendarEmail: email,
    calendarConnectedAt: new Date().toISOString(),
  });
}

export async function disconnectGoogleCalendar(): Promise<IntegrationsState> {
  const current = await readState();
  return writeState({
    ...current,
    calendarConnected: false,
    calendarEmail: undefined,
    calendarConnectedAt: undefined,
  });
}

export async function connectSmsInbox(phone = '+233 24 555 0192'): Promise<IntegrationsState> {
  const current = await readState();
  return writeState({
    ...current,
    smsConnected: true,
    smsPhone: phone,
    smsConnectedAt: new Date().toISOString(),
  });
}

export async function disconnectSmsInbox(): Promise<IntegrationsState> {
  const current = await readState();
  return writeState({
    ...current,
    smsConnected: false,
    smsPhone: undefined,
    smsConnectedAt: undefined,
  });
}

export async function clearIntegrations(): Promise<void> {
  memory.delete(KEY);
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
