import { CreateVirtualCardRequestSchema, UpdateVirtualCardRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

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

  let issued;
  try {
    issued = await lithic.createCard({
      memo: parsed.data.label,
      spendLimitCents: Math.round(parsed.data.spendLimit * 100),
    });
  } catch (error) {
    providerError(error);
    return c.json(providerFailed, 502, NO_STORE);
  }

  const db = createDb(env.DATABASE_URL);
  let row: VirtualCardRow;
  try {
    row = await insertVirtualCard(db, {
      id: `card_${crypto.randomUUID().replaceAll('-', '')}`,
      clerkUserId: c.get('auth').userId,
      providerCardToken: issued.token,
      label: parsed.data.label,
    });
  } catch (error) {
    // Never leave a live card the user can't see: close it at the issuer.
    await lithic.updateCard(issued.token, { status: 'cancelled' }).catch(providerError);
    throw error;
  }
  return c.json({ card: toVirtualCard(row, issued, 0) }, 201, NO_STORE);
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
