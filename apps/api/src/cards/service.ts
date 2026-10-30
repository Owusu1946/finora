import type { VirtualCardRecord } from '@finora/shared';

import type { AppApiEnv } from '../env';

import { createDb } from '../db/client';
import { listVirtualCardRows, type VirtualCardRow } from '../db/virtual-cards';
import { createLithicClient, LithicError, toVirtualCard, type LithicClient } from './lithic';

/** Lithic client for this environment, or null when cards are not configured. */
export function lithicFor(env: AppApiEnv) {
  if (!env.LITHIC_API_KEY) return null;
  return createLithicClient({ apiKey: env.LITHIC_API_KEY, baseUrl: env.LITHIC_API_BASE_URL });
}

/** Our card record plus its live state and spend from Lithic. */
export async function loadCard(lithic: LithicClient, row: VirtualCardRow) {
  const [card, spentCents] = await Promise.all([
    lithic.getCard(row.providerCardToken),
    lithic.spentCents(row.providerCardToken),
  ]);
  return toVirtualCard(row, card, spentCents);
}

export function logCardProviderError(error: unknown) {
  console.error('[cards:provider]', {
    errorName: error instanceof Error ? error.name : typeof error,
    status: error instanceof LithicError ? error.status : undefined,
  });
}

/**
 * The user's cards that loaded. `rowCount` lets callers tell "no cards" from
 * "every card failed to load".
 */
export async function listUserCards(env: AppApiEnv, userId: string) {
  const lithic = lithicFor(env);
  if (!lithic) return { cards: [] as VirtualCardRecord[], rowCount: 0, configured: false };
  const rows = await listVirtualCardRows(createDb(env.DATABASE_URL), userId);
  const results = await Promise.allSettled(rows.map((row) => loadCard(lithic, row)));
  const cards: VirtualCardRecord[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') cards.push(result.value);
    else logCardProviderError(result.reason);
  }
  return { cards, rowCount: rows.length, configured: true };
}
