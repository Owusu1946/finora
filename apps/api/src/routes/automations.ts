import {
  CreateAutomationInputSchema,
  ListAutomationsInputSchema,
  TestAutomationInputSchema,
  UpdateAutomationInputSchema,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';
import type { AutomationQueueMessage } from '../automations/queue';

import {
  createAutomation,
  deleteAutomation,
  evaluateAutomation,
  getAutomation,
  listAutomationLogs,
  listAutomations,
  updateAutomation,
} from '../db/automation-store';
import { listActiveAutomations } from '../db/automation-store';
import { createDb } from '../db/client';

export const automations = new Hono<AppEnv>();

automations.post('/events/balance', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    walletId?: string;
    currency?: string;
    balance?: number;
    eventId?: string;
  } | null;
  if (!body?.currency || typeof body.balance !== 'number') {
    return c.json({ message: 'currency and numeric balance are required.' }, 400);
  }
  const db = createDb(c.get('env').DATABASE_URL);
  const rows = (await listActiveAutomations(db)).filter(
    (row) =>
      row.clerkUserId === c.get('auth').userId &&
      row.trigger.type === 'balance_threshold' &&
      row.trigger.config.currency === body.currency &&
      (!row.trigger.config.walletId || row.trigger.config.walletId === body.walletId),
  );
  const eventId = body.eventId ?? `balance:${body.walletId ?? body.currency}:${Date.now()}`;
  for (const row of rows) {
    await c.env.AUTOMATION_QUEUE.send({
      kind: 'evaluate',
      automationId: row.id,
      eventId: `${eventId}:${row.id}`,
      context: { currency: body.currency as never, walletBalance: body.balance },
    } satisfies AutomationQueueMessage);
  }
  return c.json({ queued: rows.length, eventId }, 202);
});

automations.get('/', async (c) => {
  const query = ListAutomationsInputSchema.safeParse({
    ...c.req.query(),
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
  });
  if (!query.success) return c.json({ message: 'Invalid automation query.' }, 400);
  const items = await listAutomations(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    query.data.status,
    query.data.limit,
  );
  return c.json({ automations: items });
});

automations.post('/', async (c) => {
  const input = CreateAutomationInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return c.json({ message: 'Invalid automation.', issues: input.error.issues }, 400);
  const automation = await createAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data,
  );
  return c.json({ automation }, 201);
});

automations.get('/:id', async (c) => {
  const automation = await getAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!automation) return c.json({ message: 'Automation not found.' }, 404);
  const logs = await listAutomationLogs(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    automation.id,
    20,
  );
  return c.json({ automation, logs });
});

automations.patch('/:id', async (c) => {
  const input = UpdateAutomationInputSchema.safeParse({
    ...(await c.req.json().catch(() => null)),
    id: c.req.param('id'),
  });
  if (!input.success)
    return c.json({ message: 'Invalid automation update.', issues: input.error.issues }, 400);
  const automation = await updateAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data,
  );
  return automation ? c.json({ automation }) : c.json({ message: 'Automation not found.' }, 404);
});

automations.delete('/:id', async (c) => {
  const deleted = await deleteAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  return deleted ? c.body(null, 204) : c.json({ message: 'Automation not found.' }, 404);
});

automations.post('/:id/test', async (c) => {
  const input = TestAutomationInputSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!input.success)
    return c.json({ message: 'Invalid automation test context.', issues: input.error.issues }, 400);
  const automation = await getAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!automation) return c.json({ message: 'Automation not found.' }, 404);
  const result = evaluateAutomation({
    trigger: automation.trigger,
    conditions: automation.conditions,
    context: input.data.context,
    now: input.data.context.now ? new Date(input.data.context.now) : new Date(),
  });
  return c.json({
    automationId: automation.id,
    action: automation.action,
    ...result,
    dryRun: true,
  });
});

automations.post('/:id/run', async (c) => {
  const automation = await getAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!automation) return c.json({ message: 'Automation not found.' }, 404);
  if (automation.status !== 'active') return c.json({ message: 'Automation is paused.' }, 409);
  const body = (await c.req.json().catch(() => ({}))) as { context?: Record<string, unknown> };
  const eventId = `manual:${automation.id}:${Date.now()}`;
  await c.env.AUTOMATION_QUEUE.send({
    kind: 'evaluate',
    automationId: automation.id,
    eventId,
    context: body.context ?? {},
  } satisfies AutomationQueueMessage);
  return c.json({ queued: true, eventId }, 202);
});

automations.get('/:id/logs', async (c) => {
  const automation = await getAutomation(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    c.req.param('id'),
  );
  if (!automation) return c.json({ message: 'Automation not found.' }, 404);
  const logs = await listAutomationLogs(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    automation.id,
  );
  return c.json({ logs });
});
