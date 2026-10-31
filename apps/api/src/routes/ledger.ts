import { FundWalletRequestSchema, ImportWalletsRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { afterMoneyMoved } from '../automations/balance-events';
import { createDb } from '../db/client';
import {
  getLedgerTransaction,
  importWallets,
  LedgerError,
  listLedgerTransactions,
  listLedgerWallets,
  settle,
} from '../ledger/ledger';

/**
 * Wallets and Activity from the demo ledger. Money only moves through
 * approved actions, payroll runs, and card funding; these routes read it,
 * copy the app's balances in once, and record demo top-ups.
 */
export const ledger = new Hono<AppEnv>();

export function ledgerErrorBody(error: unknown) {
  if (error instanceof LedgerError) {
    return {
      body: { ok: false as const, errorCode: error.code, ...error.details },
      status: error.status,
    };
  }
  throw error;
}

ledger.get('/wallets', async (c) =>
  c.json(await listLedgerWallets(createDb(c.get('env').DATABASE_URL), c.get('auth').userId)),
);

ledger.get('/balances', async (c) =>
  c.json(await listLedgerWallets(createDb(c.get('env').DATABASE_URL), c.get('auth').userId)),
);

/** One-time copy of the app's demo balances and history. */
ledger.post('/wallets/import', async (c) => {
  const input = ImportWalletsRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ ok: false, errorCode: 'invalid_request' }, 400);
  try {
    return c.json(
      await importWallets(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, input.data),
    );
  } catch (error) {
    const { body, status } = ledgerErrorBody(error);
    return c.json(body, status);
  }
});

/** A demo deposit into one wallet. The app asks for the passcode first. */
ledger.post('/wallets/:id/fund', async (c) => {
  const input = FundWalletRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ ok: false, errorCode: 'invalid_request' }, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  const walletId = c.req.param('id');
  try {
    const wallets = await listLedgerWallets(db, userId);
    const wallet = wallets.wallets.find((item) => item.id === walletId);
    if (!wallet) throw new LedgerError('wallet_not_found', 404, { walletId });
    const transaction = await settle(db, {
      userId,
      kind: 'fund',
      sourceId: crypto.randomUUID(),
      source: 'manual',
      direction: 'received',
      currency: wallet.currency,
      amount: input.data.amount,
      counterparty: input.data.counterparty ?? 'Inbound funding',
      method: input.data.method,
      reference: input.data.reference,
      legs: [{ walletId, amount: input.data.amount }],
    });
    afterMoneyMoved(c.executionCtx, c.env.AUTOMATION_QUEUE, db, userId, transaction.id);
    return c.json({ transaction, ...(await listLedgerWallets(db, userId)) });
  } catch (error) {
    const { body, status } = ledgerErrorBody(error);
    return c.json(body, status);
  }
});

ledger.get('/transactions', async (c) => {
  const direction = c.req.query('direction');
  return c.json({
    transactions: await listLedgerTransactions(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      {
        limit: Number(c.req.query('limit') ?? 50) || 50,
        query: c.req.query('query'),
        direction:
          direction === 'sent' || direction === 'received' || direction === 'swap'
            ? direction
            : undefined,
      },
    ),
  });
});

ledger.get('/transactions/:id', async (c) => {
  const transaction = await getLedgerTransaction(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!transaction) return c.json({ ok: false, errorCode: 'transaction_not_found' }, 404);
  return c.json({ transaction });
});
