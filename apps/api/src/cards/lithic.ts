import type { VirtualCardRecord, VirtualCardStatus } from '@finora/shared';

import { z } from 'zod';

import type { VirtualCardRow } from '../db/virtual-cards';

const REQUEST_TIMEOUT_MS = 10_000;
const TRANSACTION_PAGE_SIZE = 100;
/** Guard against an unbounded pagination loop on a card with a huge history. */
const MAX_TRANSACTION_PAGES = 20;

const LithicCardSchema = z.object({
  token: z.string(),
  last_four: z.string(),
  pan: z.string().optional(),
  cvv: z.string().optional(),
  exp_month: z.string(),
  exp_year: z.string(),
  state: z.string(),
  spend_limit: z.number(),
  memo: z.string().nullable().optional(),
});
export type LithicCard = z.infer<typeof LithicCardSchema>;

const LithicTransactionPageSchema = z.object({
  data: z.array(
    z.object({ token: z.string(), result: z.string(), status: z.string(), amount: z.number() }),
  ),
  has_more: z.boolean(),
});

export class LithicError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LithicError';
  }
}

const STATE_FOR_STATUS: Record<VirtualCardStatus, 'OPEN' | 'PAUSED' | 'CLOSED'> = {
  active: 'OPEN',
  frozen: 'PAUSED',
  cancelled: 'CLOSED',
};

/** Transactions that are not money spent: declined, voided, or expired holds. */
const NON_SPEND_STATUSES = new Set(['DECLINED', 'VOIDED', 'EXPIRED']);

export function createLithicClient(options: {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
}) {
  const doFetch = options.fetch ?? fetch;

  async function request(path: string, init?: { method?: string; body?: unknown }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await doFetch(`${options.baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: options.apiKey,
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'message' in payload
            ? String(payload.message)
            : `Lithic request failed with status ${response.status}.`;
        throw new LithicError(message, response.status);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async createCard(input: { memo: string; spendLimitCents: number }) {
      return LithicCardSchema.parse(
        await request('/v1/cards', {
          method: 'POST',
          body: {
            type: 'VIRTUAL',
            memo: input.memo,
            spend_limit: input.spendLimitCents,
            spend_limit_duration: 'FOREVER',
            state: 'OPEN',
          },
        }),
      );
    },

    async getCard(token: string) {
      return LithicCardSchema.parse(await request(`/v1/cards/${encodeURIComponent(token)}`));
    },

    async updateCard(
      token: string,
      patch: { memo?: string; spendLimitCents?: number; status?: VirtualCardStatus },
    ) {
      return LithicCardSchema.parse(
        await request(`/v1/cards/${encodeURIComponent(token)}`, {
          method: 'PATCH',
          body: {
            ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
            ...(patch.spendLimitCents !== undefined
              ? { spend_limit: patch.spendLimitCents, spend_limit_duration: 'FOREVER' }
              : {}),
            ...(patch.status !== undefined ? { state: STATE_FOR_STATUS[patch.status] } : {}),
          },
        }),
      );
    },

    /** Lifetime approved spend on a card, in cents (pending and settled). */
    async spentCents(token: string) {
      let total = 0;
      let startingAfter: string | undefined;
      for (let page = 0; page < MAX_TRANSACTION_PAGES; page += 1) {
        const query = new URLSearchParams({
          card_token: token,
          page_size: String(TRANSACTION_PAGE_SIZE),
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        const result = LithicTransactionPageSchema.parse(
          await request(`/v1/transactions?${query.toString()}`),
        );
        for (const transaction of result.data) {
          if (transaction.result === 'APPROVED' && !NON_SPEND_STATUSES.has(transaction.status)) {
            total += transaction.amount;
          }
        }
        if (!result.has_more || result.data.length === 0) break;
        startingAfter = result.data.at(-1)!.token;
      }
      return total;
    },
  };
}

export type LithicClient = ReturnType<typeof createLithicClient>;

function statusFor(state: string, closedAt: Date | null): VirtualCardStatus {
  if (closedAt || state === 'CLOSED') return 'cancelled';
  if (state === 'PAUSED') return 'frozen';
  return 'active';
}

/** Combine our record with the issuer's live card into the app's card shape. */
export function toVirtualCard(
  row: VirtualCardRow,
  card: LithicCard,
  spentCents: number,
): VirtualCardRecord {
  const pan = card.pan ?? '';
  return {
    id: row.id,
    label: row.label,
    last4: card.last_four,
    network: pan.startsWith('4') ? 'visa' : 'mastercard',
    currency: 'USD',
    status: statusFor(card.state, row.closedAt),
    spendLimit: card.spend_limit / 100,
    spent: spentCents / 100,
    createdAt: row.createdAt.toISOString(),
    pan,
    expiry: `${card.exp_month.padStart(2, '0')}/${card.exp_year.slice(-2)}`,
    cvv: card.cvv ?? '',
  };
}
