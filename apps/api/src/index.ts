import { clerkMiddleware } from '@clerk/hono';
import { TOOL_NAMES } from '@finora/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { requireSession } from './auth';
import { v1 } from './routes/v1';

type AppEnv = {
  Bindings: Env;
};

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.route('/v1', v1);

export default app;
