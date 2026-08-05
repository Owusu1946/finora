import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finora.memories.v1';

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

export type MemoryKind = 'preference' | 'contact' | 'supplier' | 'note';

export type FinoraMemory = {
  id: string;
  kind: MemoryKind;
  title: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryStore = {
  enabled: boolean;
  items: FinoraMemory[];
};

export const SEED_MEMORIES: FinoraMemory[] = [
  {
    id: 'mem-pref-ghs',
    kind: 'preference',
    title: 'Local sends prefer GHS',
    detail: 'When sending in Ghana, default to the GHS wallet and MoMo rails.',
    createdAt: '2026-07-28T10:00:00Z',
    updatedAt: '2026-08-01T14:20:00Z',
  },
  {
    id: 'mem-contact-ama',
    kind: 'contact',
    title: 'Ama Mensah',
    detail: 'Frequent recipient. MTN MoMo · 0550123456 · GHS.',
    createdAt: '2026-07-20T09:12:00Z',
    updatedAt: '2026-07-30T11:05:00Z',
  },
  {
    id: 'mem-pref-usd',
    kind: 'preference',
    title: 'Keep a USD buffer',
    detail: 'Prefer leaving at least $500 in the USD wallet before converting.',
    createdAt: '2026-07-22T16:40:00Z',
    updatedAt: '2026-07-22T16:40:00Z',
  },
  {
    id: 'mem-supplier-aws',
    kind: 'supplier',
    title: 'AWS invoices',
    detail: 'Pay cloud invoices from the USD wallet after Approvals review.',
    createdAt: '2026-08-02T08:00:00Z',
    updatedAt: '2026-08-02T08:00:00Z',
  },
];

const DEFAULT_STORE: MemoryStore = {
  enabled: true,
  items: SEED_MEMORIES,
};

function normalize(raw: Partial<MemoryStore> | null): MemoryStore {
  if (!raw) return { enabled: true, items: [...SEED_MEMORIES] };
  return {
    enabled: raw.enabled ?? true,
    items: Array.isArray(raw.items) ? raw.items : [...SEED_MEMORIES],
  };
}

async function readStore(): Promise<MemoryStore> {
  const raw = await getItem(KEY);
  if (!raw) {
    const initial = { enabled: true, items: [...SEED_MEMORIES] };
    await setItem(KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return normalize(JSON.parse(raw) as Partial<MemoryStore>);
  } catch {
    return { ...DEFAULT_STORE, items: [...SEED_MEMORIES] };
  }
}

async function writeStore(store: MemoryStore): Promise<MemoryStore> {
  await setItem(KEY, JSON.stringify(store));
  return store;
}

export async function getMemoryStore(): Promise<MemoryStore> {
  return readStore();
}

export async function setMemoryEnabled(enabled: boolean): Promise<MemoryStore> {
  const store = await readStore();
  return writeStore({ ...store, enabled });
}

export async function listMemories(): Promise<FinoraMemory[]> {
  const store = await readStore();
  return store.items;
}

export async function forgetMemory(id: string): Promise<MemoryStore> {
  const store = await readStore();
  return writeStore({
    ...store,
    items: store.items.filter((m) => m.id !== id),
  });
}

export async function clearMemories(): Promise<MemoryStore> {
  const store = await readStore();
  return writeStore({ ...store, items: [] });
}

export async function clearMemoryStore(): Promise<void> {
  await removeItem(KEY);
}

export function memoryKindLabel(kind: MemoryKind): string {
  switch (kind) {
    case 'preference':
      return 'Preference';
    case 'contact':
      return 'Contact';
    case 'supplier':
      return 'Supplier';
    default:
      return 'Note';
  }
}
