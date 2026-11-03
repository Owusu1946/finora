import {
  CreateFinancialPlanInputSchema,
  GetPaymentStatusInputSchema,
  GetRecentContextInputSchema,
  PrepareConversionInputSchema,
  PrepareInvoicePaymentInputSchema,
  PreparePaymentInputSchema,
  PreparePayrollInputSchema,
  PrepareSupplierPaymentInputSchema,
  RequestApprovalInputSchema,
  SearchRecipientInputSchema,
  type PreparedAction,
} from '@finora/shared';
import { Hono, type Context } from 'hono';

import type { AppEnv } from '../app-env';

import { ActionError, getAction, listActions, prepareAction } from '../actions/actions';
import {
  findSupplier,
  paymentRequestFromInput,
  PlanInputError,
  planRequestFromInput,
  supplierPaymentRequest,
} from '../actions/inputs';
import { invoicePaymentFor, InvoicePaymentError } from '../actions/invoices';
import { createDb } from '../db/client';
import {
  getLedgerTransaction,
  LedgerError,
  listLedgerTransactions,
  listLedgerWallets,
} from '../ledger/ledger';
import { getPayee, listPayees, payeeForModel } from '../payees/payees';
import {
  getPayrollRun,
  PayrollPreparationError,
  preparePayrollImport,
} from '../payroll/prepare-import';
import { prepareDailyPlan } from '../plans/daily';

/**
 * What external AI agents (MCP) can do: read, and prepare money for the user
 * to approve in the Finora app. Everything prepared here is `source: mcp` and
 * waits in the Approvals inbox; nothing here executes. Accounts are masked.
 */
export const agentRoutes = new Hono<AppEnv>();

const WAITING =
  'Prepared. It waits in the Approvals inbox in the Finora app; only the user can approve it with their passcode.';

type Ctx = Context<AppEnv>;

async function input<T>(
  c: Ctx,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
) {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

function prepared(action: PreparedAction) {
  return {
    ok: true,
    status: 'pending_approval',
    preparationId: action.id,
    action,
    message: WAITING,
  };
}

function failure(c: Ctx, error: unknown) {
  if (
    error instanceof ActionError ||
    error instanceof LedgerError ||
    error instanceof InvoicePaymentError ||
    error instanceof PayrollPreparationError
  ) {
    return c.json(
      { ok: false, errorCode: error.code, ...('details' in error ? error.details : {}) },
      error.status,
    );
  }
  if (error instanceof PlanInputError) return c.json({ ok: false, errorCode: error.code }, 400);
  throw error;
}

const invalid = { ok: false, errorCode: 'invalid_request' } as const;

agentRoutes.get('/recipients', async (c) => {
  const parsed = SearchRecipientInputSchema.safeParse({ query: c.req.query('query') ?? '' });
  if (!parsed.success) return c.json(invalid, 400);
  const payees = await listPayees(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, {
    query: parsed.data.query,
  });
  return c.json({ recipients: payees.map(payeeForModel) });
});

agentRoutes.post('/payments', async (c) => {
  const body = await input(c, PreparePaymentInputSchema);
  if (!body) return c.json(invalid, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  const saved = body.contactId ? await getPayee(db, userId, body.contactId) : null;
  if (body.contactId && !saved) return c.json({ ok: false, errorCode: 'payee_not_found' }, 404);
  try {
    return c.json(
      prepared(await prepareAction(db, userId, paymentRequestFromInput(body, saved), 'mcp')),
      201,
    );
  } catch (error) {
    return failure(c, error);
  }
});

agentRoutes.post('/conversions', async (c) => {
  const body = await input(c, PrepareConversionInputSchema);
  if (!body) return c.json(invalid, 400);
  try {
    const action = await prepareAction(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      { kind: 'conversion', from: body.from, to: body.to, amount: body.amount },
      'mcp',
    );
    return c.json(prepared(action), 201);
  } catch (error) {
    return failure(c, error);
  }
});

agentRoutes.post('/supplier-payments', async (c) => {
  const body = await input(c, PrepareSupplierPaymentInputSchema);
  if (!body) return c.json(invalid, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  const supplier = findSupplier(await listPayees(db, userId, { kind: 'supplier' }), body);
  if (!supplier) return c.json({ ok: false, errorCode: 'supplier_not_found' }, 404);
  try {
    const action = await prepareAction(
      db,
      userId,
      supplierPaymentRequest(supplier, body.amount, body.reference),
      'mcp',
    );
    return c.json(prepared(action), 201);
  } catch (error) {
    return failure(c, error);
  }
});

agentRoutes.post('/invoice-payments', async (c) => {
  const body = await input(c, PrepareInvoicePaymentInputSchema);
  if (!body) return c.json(invalid, 400);
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  try {
    const { request } = await invoicePaymentFor(db, userId, body.invoiceId);
    return c.json(prepared(await prepareAction(db, userId, request, 'mcp')), 201);
  } catch (error) {
    return failure(c, error);
  }
});

agentRoutes.post('/payroll', async (c) => {
  const body = await input(c, PreparePayrollInputSchema);
  if (!body) return c.json(invalid, 400);
  try {
    const run = await preparePayrollImport({
      databaseUrl: c.get('env').DATABASE_URL,
      userId: c.get('auth').userId,
      ...body,
    });
    return c.json(
      { ok: true, status: 'pending_approval', preparationId: run.id, run, message: WAITING },
      201,
    );
  } catch (error) {
    return failure(c, error);
  }
});

agentRoutes.post('/plans', async (c) => {
  const body = await input(c, CreateFinancialPlanInputSchema);
  if (!body) return c.json(invalid, 400);
  try {
    const { request } = planRequestFromInput(body);
    const action = await prepareAction(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      request,
      'mcp',
    );
    return c.json(prepared(action), 201);
  } catch (error) {
    return failure(c, error);
  }
});

/** "Handle everything that needs attention today", for agents. */
agentRoutes.post('/daily-plan', async (c) => {
  try {
    const { action, notes } = await prepareDailyPlan(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      { source: 'mcp' },
    );
    if (!action) return c.json({ ok: true, empty: true, notes });
    return c.json({ ...prepared(action), notes }, 201);
  } catch (error) {
    return failure(c, error);
  }
});

/** Points the user at something already prepared; it is in their inbox already. */
agentRoutes.post('/approvals/request', async (c) => {
  const body = await input(c, RequestApprovalInputSchema);
  if (!body) return c.json(invalid, 400);
  try {
    const action = await getAction(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      body.preparationId,
    );
    return c.json({
      ok: true,
      action,
      message:
        action.status === 'pending_approval'
          ? WAITING
          : `It is ${action.status.replace('_', ' ')}.`,
    });
  } catch (error) {
    return failure(c, error);
  }
});

/** Status of a prepared action (`act_…`), payroll run (UUID), or transaction (`tx_…`). */
agentRoutes.get('/status', async (c) => {
  const parsed = GetPaymentStatusInputSchema.safeParse({
    paymentId: c.req.query('paymentId'),
    preparationId: c.req.query('preparationId') ?? c.req.query('id'),
    transactionId: c.req.query('transactionId'),
  });
  const id = parsed.success
    ? (parsed.data.preparationId ?? parsed.data.paymentId ?? parsed.data.transactionId)
    : undefined;
  if (!id) return c.json(invalid, 400);
  const env = c.get('env');
  const db = createDb(env.DATABASE_URL);
  const userId = c.get('auth').userId;
  try {
    if (id.startsWith('act_')) return c.json({ ok: true, action: await getAction(db, userId, id) });
    if (id.startsWith('tx_')) {
      const transaction = await getLedgerTransaction(db, userId, id);
      return transaction
        ? c.json({ ok: true, transaction })
        : c.json({ ok: false, errorCode: 'not_found' }, 404);
    }
    return c.json({ ok: true, run: await getPayrollRun(env.DATABASE_URL, userId, id) });
  } catch (error) {
    if (error instanceof PayrollPreparationError || error instanceof ActionError) {
      return c.json({ ok: false, errorCode: 'not_found' }, 404);
    }
    throw error;
  }
});

/** What's waiting for the user: prepared money that needs their approval. */
agentRoutes.get('/notifications', async (c) => {
  const pending = await listActions(createDb(c.get('env').DATABASE_URL), c.get('auth').userId, {
    status: 'pending_approval',
  });
  return c.json({
    notifications: pending.map((action) => ({
      id: action.id,
      kind: 'approval_needed',
      title: `${action.title}: ${action.currency} ${action.amount}`,
      createdAt: action.createdAt,
    })),
  });
});

/** Recent payees, balances, and transactions, for follow-ups like "pay her again". */
agentRoutes.get('/context', async (c) => {
  const parsed = GetRecentContextInputSchema.safeParse({
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
  });
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;
  const db = createDb(c.get('env').DATABASE_URL);
  const userId = c.get('auth').userId;
  const [payees, { wallets }, transactions] = await Promise.all([
    listPayees(db, userId),
    listLedgerWallets(db, userId),
    listLedgerTransactions(db, userId, { limit }),
  ]);
  return c.json({
    recipients: payees.slice(0, limit).map(payeeForModel),
    wallets,
    transactions,
  });
});
