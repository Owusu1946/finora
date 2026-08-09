import { normalizeFinoraTag, type FinoraTagAccount } from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FinoraTagProfile = FinoraTagAccount & {
  initials: string;
};

export type FinoraTagSuggestion = FinoraTagProfile & {
  /** Shown only for people already in the user's Finora graph. */
  source: 'recent' | 'exact';
};

export const CURRENT_FINORA_ACCOUNT = {
  accountId: 'acct_personal_001',
  subCustomerId: 'sc_personal_001',
  tag: 'kennethowusu',
} as const;

/** Prefix search against the global directory never runs below this length. */
export const FINORA_TAG_GLOBAL_MIN_CHARS = 3;
const RECENT_KEY = 'finora.finora-tags.recent.v1';
const RECENT_LIMIT = 12;
const SUGGESTION_LIMIT = 6;

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

const MOCK_FINORA_DIRECTORY: FinoraTagProfile[] = [
  {
    accountId: 'acct_personal_002',
    subCustomerId: 'sc_personal_002',
    tag: 'okenneth',
    displayName: 'O. Kenneth Mensah',
    initials: 'OK',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS', 'USD'],
  },
  {
    accountId: 'acct_personal_003',
    subCustomerId: 'sc_personal_003',
    tag: 'ama',
    displayName: 'Ama Asante',
    initials: 'AA',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS'],
  },
  {
    accountId: 'acct_business_002',
    subCustomerId: 'sc_business_002',
    tag: 'acmegh',
    displayName: 'Acme Ghana',
    initials: 'AG',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS', 'USD'],
  },
];

/** Demo seed so @ opens people you've "already paid", not the global directory. */
const SEED_RECENT_TAGS = ['okenneth', 'ama'] as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function matchesQuery(profile: Pick<FinoraTagProfile, 'tag' | 'displayName'>, query: string) {
  if (!query) return true;
  return profile.tag.startsWith(query) || profile.displayName.toLowerCase().includes(query);
}

/** Exact account lookup. Never falls back to saved contacts. */
export async function lookupFinoraTag(value: string) {
  const tag = normalizeFinoraTag(value);
  if (!tag || tag === CURRENT_FINORA_ACCOUNT.tag) return null;
  return MOCK_FINORA_DIRECTORY.find((profile) => profile.tag === tag) ?? null;
}

export async function listRecentFinoraTags(): Promise<FinoraTagSuggestion[]> {
  const raw = await getItem(RECENT_KEY);
  let tags: string[] = [];
  if (!raw) {
    tags = [...SEED_RECENT_TAGS];
    await setItem(RECENT_KEY, JSON.stringify(tags));
  } else {
    try {
      const parsed = JSON.parse(raw) as string[];
      tags = Array.isArray(parsed) ? parsed.map(normalizeFinoraTag).filter(Boolean) : [];
    } catch {
      tags = [...SEED_RECENT_TAGS];
    }
  }

  const profiles: FinoraTagSuggestion[] = [];
  for (const tag of tags) {
    if (tag === CURRENT_FINORA_ACCOUNT.tag) continue;
    const profile = await lookupFinoraTag(tag);
    if (!profile || profile.status !== 'active') continue;
    profiles.push({ ...profile, source: 'recent' });
  }
  return profiles;
}

export async function rememberFinoraTagRecipient(input: {
  tag: string;
  displayName?: string;
  subCustomerId?: string;
  accountId?: string;
  walletCurrencies?: string[];
  country?: string;
}): Promise<void> {
  const tag = normalizeFinoraTag(input.tag);
  if (!tag || tag === CURRENT_FINORA_ACCOUNT.tag) return;

  // Keep the mock directory in sync for people we only learned via a transfer.
  if (!(await lookupFinoraTag(tag))) {
    MOCK_FINORA_DIRECTORY.unshift({
      accountId: input.accountId ?? `acct_${tag}`,
      subCustomerId: input.subCustomerId ?? `sc_${tag}`,
      tag,
      displayName: input.displayName?.trim() || tag,
      initials: initialsFromName(input.displayName || tag),
      country: input.country ?? 'GH',
      status: 'active',
      walletCurrencies: input.walletCurrencies?.length ? input.walletCurrencies : ['GHS'],
    });
  }

  const recent = await listRecentFinoraTags();
  const next = [tag, ...recent.map((item) => item.tag).filter((item) => item !== tag)].slice(
    0,
    RECENT_LIMIT,
  );
  await setItem(RECENT_KEY, JSON.stringify(next));
}

/**
 * Autocomplete source for the composer.
 *
 * - `@` / short prefixes: only people already in the user's recent Finora graph
 * - 3+ chars: recent matches, plus an exact global hit if the full tag exists
 * - Never returns a global prefix dump of the platform directory
 */
export async function searchFinoraTags(query: string): Promise<FinoraTagSuggestion[]> {
  const needle = normalizeFinoraTag(query);
  const recent = await listRecentFinoraTags();
  const recentMatches = recent
    .filter((profile) => matchesQuery(profile, needle))
    .slice(0, SUGGESTION_LIMIT);

  if (needle.length < FINORA_TAG_GLOBAL_MIN_CHARS) {
    return recentMatches;
  }

  const exact = await lookupFinoraTag(needle);
  if (!exact || exact.status !== 'active') return recentMatches;
  if (recentMatches.some((profile) => profile.tag === exact.tag)) return recentMatches;

  const exactSuggestion: FinoraTagSuggestion = { ...exact, source: 'exact' };
  return [exactSuggestion, ...recentMatches].slice(0, SUGGESTION_LIMIT);
}

export async function clearRecentFinoraTags(): Promise<void> {
  memory.delete(RECENT_KEY);
  try {
    await AsyncStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}
