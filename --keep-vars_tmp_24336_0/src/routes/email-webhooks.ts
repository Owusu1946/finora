import { verifyWebhook } from '@clerk/backend/webhooks';
import { Hono } from 'hono';
import { Resend } from 'resend';

import type { AppEnv } from '../app-env';

import { createDb } from '../db/client';
import {
  getOrCreateWelcomeDelivery,
  isTerminalDeliveryStatus,
  updateDeliveryFromProviderEvent,
} from '../db/transactional-email-deliveries';
import { getWelcomeEmailRecipient } from '../email/clerk-event';

export const emailWebhooks = new Hono<AppEnv>();

emailWebhooks.post('/clerk', async (c) => {
  const env = c.var.env;
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error('Clerk webhook received before its signing secret was configured.');
    return c.json({ error: 'Webhook is not configured.' }, 503);
  }

  let event;
  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch {
    return c.json({ error: 'Invalid webhook signature.' }, 400);
  }

  if (env.WELCOME_EMAIL_MODE === 'disabled') {
    return c.json({ received: true, queued: false });
  }

  const recipient = getWelcomeEmailRecipient(event);
  if (!recipient) return c.json({ received: true, queued: false });

  const db = createDb(env.DATABASE_URL);
  const delivery = await getOrCreateWelcomeDelivery(db, recipient);
  if (delivery.status === 'sent' || isTerminalDeliveryStatus(delivery.status)) {
    return c.json({ received: true, queued: false });
  }

  await c.env.TRANSACTIONAL_EMAIL_QUEUE.send({ deliveryId: delivery.id });
  return c.json({ received: true, queued: true });
});

const resendStatusByEvent = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.suppressed': 'suppressed',
  'email.failed': 'failed',
} as const;

emailWebhooks.post('/resend', async (c) => {
  const env = c.var.env;
  if (!env.RESEND_API_KEY || !env.RESEND_WEBHOOK_SECRET) {
    console.error('Resend webhook received before its secrets were configured.');
    return c.json({ error: 'Webhook is not configured.' }, 503);
  }

  const payload = await c.req.text();
  const id = c.req.header('svix-id');
  const timestamp = c.req.header('svix-timestamp');
  const signature = c.req.header('svix-signature');
  if (!id || !timestamp || !signature) {
    return c.json({ error: 'Missing webhook signature headers.' }, 400);
  }

  let event;
  try {
    event = new Resend(env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return c.json({ error: 'Invalid webhook signature.' }, 400);
  }

  const status = Reflect.get(resendStatusByEvent, event.type) as
    | (typeof resendStatusByEvent)[keyof typeof resendStatusByEvent]
    | undefined;
  if (!status || !('email_id' in event.data)) return c.json({ received: true });

  const deliveryId = 'tags' in event.data ? event.data.tags?.delivery_id : undefined;
  await updateDeliveryFromProviderEvent(
    createDb(env.DATABASE_URL),
    event.data.email_id,
    status,
    deliveryId,
  );
  return c.json({ received: true });
});
