import {
  CheckPolicyInputSchema,
  SavePayeeRequestSchema,
  UpdateApprovalPolicyRequestSchema,
  UpdatePayeeRequestSchema,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { createDb } from '../db/client';
import {
  deletePayee,
  importPayees,
  listPayees,
  PayeeError,
  savePayee,
  updatePayee,
} from '../payees/payees';
import { evaluateActionPolicy } from '../policies/evaluate';
import { listPolicies, PolicyError, updatePolicy } from '../policies/policies';

/** Saved contacts and suppliers. */
export const payeeRoutes = new Hono<AppEnv>();

/** Approval policies. */
export const policyRoutes = new Hono<AppEnv>();

const invalid = { ok: false, errorCode: 'invalid_request' } as const;

payeeRoutes.get('/', async (c) => {
  const kind = c.req.query('kind');
  return c.json({
    payees: await listPayees(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, {
      kind: kind === 'contact' || kind === 'supplier' ? kind : undefined,
      query: c.req.query('query') || undefined,
    }),
  });
});

payeeRoutes.post('/', async (c) => {
  const input = SavePayeeRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  const payee = await savePayee(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data,
  );
  return c.json({ payee }, 201);
});

/** One-time copy of the contacts saved on the device. */
payeeRoutes.post('/import', async (c) => {
  try {
    return c.json({
      payees: await importPayees(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        await c.req.json().catch(() => null),
      ),
    });
  } catch (error) {
    if (error instanceof PayeeError)
      return c.json({ ok: false, errorCode: error.code }, error.status);
    return c.json(invalid, 400);
  }
});

payeeRoutes.patch('/:id', async (c) => {
  const input = UpdatePayeeRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  try {
    return c.json({
      payee: await updatePayee(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
        input.data,
      ),
    });
  } catch (error) {
    if (error instanceof PayeeError)
      return c.json({ ok: false, errorCode: error.code }, error.status);
    throw error;
  }
});

payeeRoutes.delete('/:id', async (c) => {
  try {
    await deletePayee(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, c.req.param('id'));
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof PayeeError)
      return c.json({ ok: false, errorCode: error.code }, error.status);
    throw error;
  }
});

policyRoutes.get('/', async (c) =>
  c.json({
    policies: await listPolicies(createDb(c.get('env').DATABASE_URL), c.get('auth').userId),
  }),
);

policyRoutes.patch('/:id', async (c) => {
  const input = UpdateApprovalPolicyRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  try {
    return c.json({
      policy: await updatePolicy(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
        input.data,
      ),
    });
  } catch (error) {
    if (error instanceof PolicyError) return c.json({ ok: false, errorCode: error.code }, 404);
    throw error;
  }
});

/** What the user's policies would say about an intended payment, before preparing it. */
policyRoutes.post('/check', async (c) => {
  const input = CheckPolicyInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success || !input.data.amount) return c.json(invalid, 400);
  const result = await evaluateActionPolicy(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    {
      kind: input.data.action.includes('conversion') ? 'conversion' : 'payment',
      amount: input.data.amount.amount,
      currency: input.data.amount.currency,
      recipient: input.data.destinationValue ?? null,
    },
  );
  return c.json({
    action: input.data.action,
    ...result,
    allowed: result.outcome !== 'blocked',
    // Every money movement still needs the user's passcode in the app.
    requiresApproval: true,
  });
});
