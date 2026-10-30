import { clerkMiddleware } from '@clerk/hono';
import { PLATFORM_TOOL_NAMES } from '@finora/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from './app-env';

import { requireSession } from './auth';
import { enqueueDueAutomations, runAutomationMessage } from './automations/runner';
import { consumeTransactionalEmailQueue } from './email/consumer';
import { getApiEnv } from './env';
import { consumeCalendarSyncQueue } from './integrations/calendar-consumer';
import { consumeGmailSyncQueue } from './integrations/gmail-consumer';
import { automations } from './routes/automations';
import { businessApps } from './routes/business-apps';
import { calendarIntegrations, calendarOAuth } from './routes/calendar-integrations';
import { cards } from './routes/cards';
import { chat } from './routes/chat';
import { chats } from './routes/chats';
import { driveIntegrations, driveOAuth } from './routes/drive-integrations';
import { emailWebhooks } from './routes/email-webhooks';
import { gmailIntegrations, googleOAuth } from './routes/gmail-integrations';
import { invoiceRoutes } from './routes/invoices';
import { memories } from './routes/memories';
import { payroll } from './routes/payroll';
import { v1 } from './routes/v1';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set('env', getApiEnv(c.env));
  await next();
});

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
    tools: PLATFORM_TOOL_NAMES,
    docs: 'Money-moving routes return pending_approval; humans resolve via /v1/approvals/:id/resolve',
  }),
);

app.get('/health', (c) => c.json({ ok: true, mode: 'mock' }));

app.route('/webhooks', emailWebhooks);
app.route('/oauth/google', googleOAuth);
app.route('/oauth/google-calendar', calendarOAuth);
app.route('/oauth/google-drive', driveOAuth);

app.post('/v1/webhooks/wewire', async (c) => {
  const payload = await c.req.json();
  console.log('wewire webhook', payload);
  return c.json({ received: true, mode: 'mock' });
});

app.use('/v1/*', clerkMiddleware({ clockSkewInMs: 30_000 }));
app.use('/v1/*', requireSession);
app.route('/v1/chat', chat);
app.route('/v1/chats', chats);
app.route('/v1/integrations/gmail', gmailIntegrations);
app.route('/v1/integrations/calendar', calendarIntegrations);
app.route('/v1/integrations/drive', driveIntegrations);
app.route('/v1/invoices', invoiceRoutes);
app.route('/v1/memories', memories);
app.route('/v1/automations', automations);
app.route('/v1/apps', businessApps);
app.route('/v1/cards', cards);
app.route('/v1/payroll', payroll);
app.route('/v1', v1);

async function consumeQueue(batch: MessageBatch<unknown>, env: Env) {
  if (batch.queue === 'finora-gmail-sync') return consumeGmailSyncQueue(batch, env);
  if (batch.queue === 'finora-calendar-sync') return consumeCalendarSyncQueue(batch, env);
  if (batch.queue === 'finora-automation-evaluation') {
    for (const message of batch.messages) await runAutomationMessage(message, env);
    return;
  }
  return consumeTransactionalEmailQueue(batch, env);
}

export default {
  fetch: app.fetch,
  queue: consumeQueue,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(enqueueDueAutomations(env));
  },
} satisfies ExportedHandler<Env>;
