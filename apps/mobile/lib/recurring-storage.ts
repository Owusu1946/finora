import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MOCK_RECURRING,
  type RecurringPayment,
  type RecurringStatus,
} from '@/components/recurring/types';

const KEY = 'finora.recurring.v1';

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

export async function listRecurring(): Promise<RecurringPayment[]> {
  const raw = await getItem(KEY);
  if (!raw) {
    await setItem(KEY, JSON.stringify(MOCK_RECURRING));
    return [...MOCK_RECURRING];
  }
  try {
    const parsed = JSON.parse(raw) as RecurringPayment[];
    return Array.isArray(parsed) ? parsed : [...MOCK_RECURRING];
  } catch {
    return [...MOCK_RECURRING];
  }
}

export async function saveRecurring(payment: RecurringPayment): Promise<RecurringPayment> {
  const items = await listRecurring();
  await setItem(KEY, JSON.stringify([payment, ...items]));
  return payment;
}

export async function updateRecurringStatus(
  id: string,
  status: RecurringStatus,
): Promise<RecurringPayment | null> {
  const items = await listRecurring();
  const idx = items.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next: RecurringPayment = { ...items[idx]!, status };
  await setItem(
    KEY,
    JSON.stringify(items.map((r, i) => (i === idx ? next : r))),
  );
  return next;
}

export async function clearRecurring(): Promise<void> {
  memory.delete(KEY);
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
