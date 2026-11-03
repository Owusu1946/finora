import { InsightPeriodSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { createDb } from '../db/client';
import { financialReport, treasuryOverview } from '../insights/service';

/** Treasury and reports from the ledger, for the app's screens. */
export const insightRoutes = new Hono<AppEnv>();

insightRoutes.get('/treasury', async (c) =>
  c.json({
    overview: await treasuryOverview(createDb(c.get('env').DATABASE_URL), c.get('auth').userId),
  }),
);

insightRoutes.get('/report', async (c) => {
  const period = InsightPeriodSchema.safeParse(c.req.query('period') ?? 'month');
  if (!period.success) return c.json({ ok: false, errorCode: 'invalid_period' }, 400);
  return c.json({
    report: await financialReport(
      createDb(c.get('env').DATABASE_URL),
      c.get('auth').userId,
      period.data,
    ),
  });
});
