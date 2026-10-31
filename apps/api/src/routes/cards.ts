import {
  CreateVirtualCardRequestSchema,
  MAX_VIRTUAL_CARD_LIMIT,
  TopUpVirtualCardRequestSchema,
  UpdateVirtualCardRequestSchema,
  VIRTUAL_CARD_ISSUE_FEE_USD,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { afterMoneyMoved } from '../automations/balance-events';
import { toVirtualCard } from '../cards/lithic';
import {
  lithicFor,
  listUserCards,
  loadCard,
  logCardProviderError as providerError,
} from '../cards/service';
import { createDb } from '../db/client';
import {
  getVirtualCardRow,
  insertVirtualCard,
  updateVirtualCardRow,
  type VirtualCardRow,
} from '../db/virtual-cards';
import { LedgerError, settle, walletCost } from '../ledger/ledger';

/** Responses carry live card details; never let them be cached. */
const NO_STORE = { 'Cache-Control': 'no-store' };

export const cards = new Hono<AppEnv>();

const unavailable = {
  error: 'cards_unavailable',
  message: 'Virtual cards are not configured.',
} as const;
const providerFailed = {
  error: 'card_provider_error',
  message: 'The card issuer did not respond. Try again.',
} as const;

type Db = ReturnType<typeof createDb>;

type Charge = {
  userId: string;
  walletId: string;
  /** What goes onto the card, in USD; the $1 fee is added. */
  amountUsd: number;
  sourceId: string;
  counterparty: string;
  reference: string;
};

/** Takes the card load plus the $1 fee from the chosen wallet (converted at demo rates). */
async function chargeForCard(db: Db, charge: Charge) {
  const cost = await walletCost(
    db,
    charge.userId,
    charge.walletId,
    charge.amountUsd + VIRTUAL_CARD_ISSUE_FEE_USD,
    'USD',
  );
  await settle(db, {
    userId: charge.userId,
    kind: 'card_funding',
    sourceId: charge.sourceId,
    source: 'manual',
    direction: 'sent',
    currency: cost.wallet.currency,
    amount: cost.amount,
    counterparty: charge.counterparty,
    method: 'Virtual card',
    reference: charge.reference,
    legs: [{ walletId: cost.wallet.id, amount: -cost.amount }],
  });
  return cost;
}

/** Puts a card charge back when the issuer didn't take the card or top-up. */
async function refundCardCharge(
  db: Db,
  charge: Charge,
  cost: Awaited<ReturnType<typeof chargeForCard>>,
) {
  await settle(db, {
    userId: charge.userId,
    kind: 'card_funding_refund',
    sourceId: charge.sourceId,
    source: 'manual',
    direction: 'received',
    currency: cost.wallet.currency,
    amount: cost.amount,
    counterparty: `${charge.counterparty} refund`,
    method: 'Refund',
    legs: [{ walletId: cost.wallet.id, amount: cost.amount }],
  });
}

function chargeError(error: unknown) {
  if (!(error instanceof LedgerError)) throw error;
  return {
    error: error.code,
    message:
      error.code === 'insufficient_funds'
        ? `Not enough in your ${String(error.details?.currency ?? '')} wallet.`
        : 'That account is no longer available.',
  };
}

cards.get('/', async (c) => {
  const {
    cards: list,
    rowCount,
    configured,
  } = await listUserCards(c.get('env'), c.get('auth').userId);
  if (!configured) return c.json(unavailable, 503, NO_STORE);
  // Every card failed to load: report it instead of showing an empty wallet.
  if (rowCount > 0 && list.length === 0) return c.json(providerFailed, 502, NO_STORE);
  return c.json({ cards: list }, 200, NO_STORE);
});

cards.get('/:id', async (c) => {
  const env = c.get('env');
  const lithic = lithicFor(env);
  if (!lithic) return c.json(unavailable, 503, NO_STORE);

  const row = await getVirtualCardRow(
    createDb(env.DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!row) return c.json({ error: 'card_not_found', message: 'Card not found.' }, 404, NO_STORE);
  try {
    return c.json({ card: await loadCard(lithic, row) }, 200, NO_STORE);
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

cards.post('/', async (c) => {
  const env = c.get('env');
  const lithic = lithicFor(env);
  if (!lithic) return c.json(unavailable, 503, NO_STORE);

  const body: unknown = await c.req.json().catch(() => null);
  if (
    typeof body === 'object' &&
    body !== null &&
    'currency' in body &&
    body.currency !== undefined &&
    body.currency !== 'USD'
  ) {
    return c.json(
      { error: 'currency_not_supported', message: 'Cards are issued in USD.' },
      400,
      NO_STORE,
    );
  }
  const parsed = CreateVirtualCardRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'invalid_request', message: 'Enter a card name and a spend limit.' },
      400,
      NO_STORE,
    );
  }

  const db = createDb(env.DATABASE_URL);
  const id = `card_${crypto.randomUUID().replaceAll('-', '')}`;
  const charge: Charge = {
    userId: c.get('auth').userId,
    walletId: parsed.data.fundingWalletId,
    amountUsd: parsed.data.spendLimit,
    sourceId: id,
    counterparty: `${parsed.data.label} card`,
    reference: `Card load $${parsed.data.spendLimit} + $${VIRTUAL_CARD_ISSUE_FEE_USD} issue fee`,
  };
  // Charge first: a card is never issued unpaid.
  let cost;
  try {
    cost = await chargeForCard(db, charge);
  } catch (error) {
    return c.json(chargeError(error), 409, NO_STORE);
  }

  let issued;
  try {
    issued = await lithic.createCard({
      memo: parsed.data.label,
      spendLimitCents: Math.round(parsed.data.spendLimit * 100),
    });
  } catch (error) {
    providerError(error);
    await refundCardCharge(db, charge, cost);
    return c.json(providerFailed, 502, NO_STORE);
  }

  let row: VirtualCardRow;
  try {
    row = await insertVirtualCard(db, {
      id,
      clerkUserId: c.get('auth').userId,
      providerCardToken: issued.token,
      label: parsed.data.label,
    });
  } catch (error) {
    // Never leave a live card the user can't see: close it at the issuer.
    await lithic.updateCard(issued.token, { status: 'cancelled' }).catch(providerError);
    await refundCardCharge(db, charge, cost);
    throw error;
  }
  afterMoneyMoved(c.executionCtx, c.env.AUTOMATION_QUEUE, db, charge.userId, charge.sourceId);
  return c.json({ card: toVirtualCard(row, issued, 0) }, 201, NO_STORE);
});

cards.get('/:id/transactions', async (c) => {
  const env = c.get('env');
  const lithic = lithicFor(env);
  if (!lithic) return c.json(unavailable, 503, NO_STORE);

  // Ownership check first: only the card's owner can read its purchases.
  const row = await getVirtualCardRow(
    createDb(env.DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!row) return c.json({ error: 'card_not_found', message: 'Card not found.' }, 404, NO_STORE);
  try {
    const transactions = await lithic.listTransactions(row.providerCardToken);
    return c.json({ transactions }, 200, NO_STORE);
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

cards.post('/:id/top-up', async (c) => {
  const env = c.get('env');
  const lithic = lithicFor(env);
  if (!lithic) return c.json(unavailable, 503, NO_STORE);

  const parsed = TopUpVirtualCardRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', message: 'Enter an amount to add.' }, 400, NO_STORE);
  }
  const db = createDb(env.DATABASE_URL);
  const row = await getVirtualCardRow(db, c.get('auth').userId, c.req.param('id'));
  if (!row) return c.json({ error: 'card_not_found', message: 'Card not found.' }, 404, NO_STORE);
  if (row.closedAt) {
    return c.json(
      { error: 'card_closed', message: 'This card is cancelled and cannot be topped up.' },
      409,
      NO_STORE,
    );
  }

  let nextCents;
  try {
    // Add to the issuer's current balance so a stale client can't overwrite it.
    const current = await lithic.getCard(row.providerCardToken);
    nextCents = current.spend_limit + Math.round(parsed.data.amount * 100);
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }
  if (nextCents > MAX_VIRTUAL_CARD_LIMIT * 100) {
    return c.json(
      {
        error: 'limit_exceeded',
        message: `A card can hold up to $${MAX_VIRTUAL_CARD_LIMIT.toLocaleString('en-US')} in total.`,
      },
      400,
      NO_STORE,
    );
  }

  const charge: Charge = {
    userId: c.get('auth').userId,
    walletId: parsed.data.fundingWalletId,
    amountUsd: parsed.data.amount,
    sourceId: `${row.id}:${crypto.randomUUID()}`,
    counterparty: `${row.label} card top-up`,
    reference: `Top-up $${parsed.data.amount} + $${VIRTUAL_CARD_ISSUE_FEE_USD} fee`,
  };
  let cost;
  try {
    cost = await chargeForCard(db, charge);
  } catch (error) {
    return c.json(chargeError(error), 409, NO_STORE);
  }

  try {
    await lithic.updateCard(row.providerCardToken, { spendLimitCents: nextCents });
  } catch (error) {
    providerError(error);
    await refundCardCharge(db, charge, cost);
    return c.json(providerFailed, 502, NO_STORE);
  }
  afterMoneyMoved(c.executionCtx, c.env.AUTOMATION_QUEUE, db, charge.userId, charge.sourceId);
  try {
    return c.json({ card: await loadCard(lithic, row) }, 200, NO_STORE);
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

cards.patch('/:id', async (c) => {
  const env = c.get('env');
  const lithic = lithicFor(env);
  if (!lithic) return c.json(unavailable, 503, NO_STORE);

  const parsed = UpdateVirtualCardRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', message: 'Invalid card update.' }, 400, NO_STORE);
  }

  const db = createDb(env.DATABASE_URL);
  const userId = c.get('auth').userId;
  const id = c.req.param('id');
  const row = await getVirtualCardRow(db, userId, id);
  if (!row) return c.json({ error: 'card_not_found', message: 'Card not found.' }, 404, NO_STORE);
  if (row.closedAt) {
    return c.json(
      { error: 'card_closed', message: 'This card is cancelled and cannot be changed.' },
      409,
      NO_STORE,
    );
  }

  const { label, spendLimit, status } = parsed.data;
  try {
    // Cards are prepaid: balance only grows through a paid top-up, never by editing the limit.
    if (spendLimit !== undefined) {
      const current = await lithic.getCard(row.providerCardToken);
      if (Math.round(spendLimit * 100) > current.spend_limit) {
        return c.json(
          { error: 'use_top_up', message: 'Add money to the card with a top-up.' },
          400,
          NO_STORE,
        );
      }
    }
    await lithic.updateCard(row.providerCardToken, {
      memo: label,
      spendLimitCents: spendLimit === undefined ? undefined : Math.round(spendLimit * 100),
      status,
    });
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }

  const updated =
    label !== undefined || status === 'cancelled'
      ? await updateVirtualCardRow(db, userId, id, {
          ...(label !== undefined ? { label } : {}),
          ...(status === 'cancelled' ? { closedAt: new Date() } : {}),
        })
      : row;
  try {
    return c.json({ card: await loadCard(lithic, updated ?? row) }, 200, NO_STORE);
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});
