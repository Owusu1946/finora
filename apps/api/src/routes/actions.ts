import { ExecuteActionRequestSchema, PrepareActionRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import {
  ActionError,
  cancelAction,
  executeAction,
  getAction,
  listActions,
  prepareAction,
  updatePendingAction,
} from '../actions/actions';
import { afterMoneyMoved } from '../automations/balance-events';
import { createDb } from '../db/client';
import { LedgerError } from '../ledger/ledger';

/**
 * Prepared payments, conversions, and plans. Anyone can prepare one (chat, the
 * app, automations, MCP); `execute` is called by the app only after the user
 * approves it with their passcode.
 */
export const actions = new Hono<AppEnv>();

function actionError(error: unknown) {
  if (error instanceof ActionError || error instanceof LedgerError) {
    return {
      body: { ok: false as const, errorCode: error.code, ...error.details },
      status: error.status,
    };
  }
  throw error;
}

actions.get('/', async (c) => {
  const status = c.req.query('status');
  return c.json({
    actions: await listActions(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, {
      status:
        status === 'pending_approval' ||
        status === 'executed' ||
        status === 'cancelled' ||
        status === 'failed'
          ? status
          : undefined,
      relatedId: c.req.query('relatedId') || undefined,
    }),
  });
});

actions.post('/', async (c) => {
  const input = PrepareActionRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ ok: false, errorCode: 'invalid_request' }, 400);
  try {
    const action = await prepareAction(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      input.data,
      'manual',
    );
    return c.json({ action }, 201);
  } catch (error) {
    const { body, status } = actionError(error);
    return c.json(body, status);
  }
});

actions.get('/:id', async (c) => {
  try {
    return c.json({
      action: await getAction(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
      ),
    });
  } catch (error) {
    const { body, status } = actionError(error);
    return c.json(body, status);
  }
});

/** Replaces a pending action's details after the user edited them on the card. */
actions.put('/:id', async (c) => {
  const input = PrepareActionRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ ok: false, errorCode: 'invalid_request' }, 400);
  try {
    return c.json({
      action: await updatePendingAction(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
        input.data,
      ),
    });
  } catch (error) {
    const { body, status } = actionError(error);
    return c.json(body, status);
  }
});

actions.post('/:id/execute', async (c) => {
  const input = ExecuteActionRequestSchema.safeParse((await c.req.json().catch(() => null)) ?? {});
  if (!input.success) return c.json({ ok: false, errorCode: 'invalid_request' }, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  try {
    const action = await executeAction(db, userId, c.req.param('id'), input.data);
    afterMoneyMoved(c.executionCtx, c.env.AUTOMATION_QUEUE, db, userId, action.transactionId);
    return c.json({ action });
  } catch (error) {
    const { body, status } = actionError(error);
    return c.json(body, status);
  }
});

actions.post('/:id/cancel', async (c) => {
  try {
    return c.json({
      action: await cancelAction(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
      ),
    });
  } catch (error) {
    const { body, status } = actionError(error);
    return c.json(body, status);
  }
});
