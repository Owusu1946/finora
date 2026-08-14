import { clerkMiddleware } from '@clerk/hono';
import { createApiEnv } from '@finora/env/api';
import { TOOL_NAMES } from '@finora/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from './types';

import { requireSession } from './auth';
import { chat } from './routes/chat';
import { v1 } from './routes/v1';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set(
    'env',
    createApiEnv({
      ENVIRONMENT: c.env.ENVIRONMENT,
      DATABASE_URL: c.env.DATABASE_URL,
      CLERK_SECRET_KEY: c.env.CLERK_SECRET_KEY,
      CLERK_PUBLISHABLE_KEY: c.env.CLERK_PUBLISHABLE_KEY,
      OPENAI_API_KEY: c.env.OPENAI_API_KEY,
      WEWIRE_API_KEY: c.env.WEWIRE_API_KEY,
      WEWIRE_WEBHOOK_SECRET: c.env.WEWIRE_WEBHOOK_SECRET,
    }),
  );
  await next();
});

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id'],
  }),
);

app.get('/', (c) =>
  c.json({
    name: 'finora-api',
    status: 'ok',
    mode: 'mock',
    tools: TOOL_NAMES,
    docs: 'Money-moving routes return pending_approval; humans resolve via /v1/approvals/:id/resolve',
  }),
);

app.get('/health', (c) => c.json({ ok: true, mode: 'mock' }));

app.post('/v1/webhooks/wewire', async (c) => {
  const payload = await c.req.json();
  console.log('wewire webhook', payload);
  return c.json({ received: true, mode: 'mock' });
});

app.use('/v1/*', clerkMiddleware());
app.use('/v1/*', requireSession);
app.route('/v1/chat', chat);
app.route('/v1', v1);

export default app;
