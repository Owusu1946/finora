import { CreateRecurringRequestSchema, UpdateRecurringRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { createDb } from '../db/client';
import {
  createSchedule,
  getSchedule,
  listSchedules,
  RecurringError,
  setScheduleStatus,
} from '../recurring/recurring';

/**
 * Recurring payment schedules. A schedule never pays by itself: on each due
 * date Finora prepares the payment for the user to approve.
 */
export const recurringRoutes = new Hono<AppEnv>();

const invalid = { ok: false, errorCode: 'invalid_request' } as const;

recurringRoutes.get('/', async (c) =>
  c.json({
    schedules: await listSchedules(createDb(c.get('env').DATABASE_URL), c.get('auth').userId),
  }),
);

recurringRoutes.post('/', async (c) => {
  const input = CreateRecurringRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  const schedule = await createSchedule(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data,
  );
  return c.json({ schedule }, 201);
});

recurringRoutes.get('/:id', async (c) => {
  try {
    return c.json({
      schedule: await getSchedule(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
      ),
    });
  } catch (error) {
    if (error instanceof RecurringError) {
      return c.json({ ok: false, errorCode: error.code }, error.status);
    }
    throw error;
  }
});

recurringRoutes.patch('/:id', async (c) => {
  const input = UpdateRecurringRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  try {
    return c.json({
      schedule: await setScheduleStatus(
        createDb(c.get('env').DATABASE_URL),
        c.get('auth').userId,
        c.req.param('id'),
        input.data.status,
      ),
    });
  } catch (error) {
    if (error instanceof RecurringError) {
      return c.json({ ok: false, errorCode: error.code }, error.status);
    }
    throw error;
  }
});
