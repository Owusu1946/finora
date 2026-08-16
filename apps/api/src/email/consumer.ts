import { Resend } from 'resend';

import { createDb } from '../db/client';
import {
  getTransactionalEmailDelivery,
  isTerminalDeliveryStatus,
  markDeliveryFailed,
  markDeliverySending,
  markDeliverySent,
  welcomeEmailKind,
} from '../db/transactional-email-deliveries';
import { getApiEnv } from '../env';
import { isWelcomeEmailQueueMessage } from './queue';
import { renderWelcomeEmail } from './welcome-email';

type ResendError = {
  name?: string;
  statusCode?: number | null;
};

function getErrorCode(error: ResendError) {
  return error.name?.trim() || `resend_${error.statusCode ?? 'unknown'}`;
}

export function isTransientResendError(error: ResendError) {
  return error.statusCode === 429 || (error.statusCode != null && error.statusCode >= 500);
}

export async function consumeTransactionalEmailQueue(batch: MessageBatch<unknown>, bindings: Env) {
  const env = getApiEnv(bindings);
  const db = createDb(env.DATABASE_URL);

  for (const message of batch.messages) {
    if (!isWelcomeEmailQueueMessage(message.body)) {
      console.warn('Discarding malformed transactional email queue message.', {
        messageId: message.id,
      });
      message.ack();
      continue;
    }

    const delivery = await getTransactionalEmailDelivery(db, message.body.deliveryId);
    if (!delivery || delivery.emailKind !== welcomeEmailKind) {
      console.warn('Discarding transactional email queue message with unknown delivery.', {
        messageId: message.id,
      });
      message.ack();
      continue;
    }

    if (delivery.status === 'sent' || isTerminalDeliveryStatus(delivery.status)) {
      message.ack();
      continue;
    }

    if (env.WELCOME_EMAIL_MODE === 'disabled') {
      await markDeliveryFailed(db, delivery.id, 'welcome_email_disabled');
      message.ack();
      continue;
    }

    if (!env.RESEND_API_KEY) {
      await markDeliveryFailed(db, delivery.id, 'resend_api_key_missing');
      message.ack();
      continue;
    }

    if (env.WELCOME_EMAIL_MODE === 'redirect' && !env.WELCOME_EMAIL_REDIRECT_TO) {
      await markDeliveryFailed(db, delivery.id, 'welcome_email_redirect_missing');
      message.ack();
      continue;
    }

    await markDeliverySending(db, delivery.id);

    try {
      const recipient =
        env.WELCOME_EMAIL_MODE === 'redirect'
          ? env.WELCOME_EMAIL_REDIRECT_TO!
          : delivery.recipientEmail;
      const { html, text } = await renderWelcomeEmail({
        firstName: delivery.recipientName,
        ctaUrl: env.WELCOME_EMAIL_CTA_URL,
      });
      const resend = new Resend(env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send(
        {
          from: env.WELCOME_EMAIL_FROM,
          to: [recipient],
          replyTo: env.WELCOME_EMAIL_REPLY_TO,
          subject: delivery.recipientName
            ? `Welcome to Finora, ${delivery.recipientName}`
            : 'Welcome to Finora',
          html,
          text,
          tags: [{ name: 'delivery_id', value: delivery.id }],
        },
        { idempotencyKey: `welcome-email/${delivery.clerkUserId}` },
      );

      if (error) {
        await markDeliveryFailed(db, delivery.id, getErrorCode(error));
        if (isTransientResendError(error)) message.retry({ delaySeconds: 60 });
        else message.ack();
        continue;
      }

      await markDeliverySent(db, delivery.id, data.id);
      message.ack();
    } catch (error) {
      await markDeliveryFailed(db, delivery.id, 'email_delivery_exception');
      console.error('Transactional email delivery failed unexpectedly.', {
        deliveryId: delivery.id,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      message.retry({ delaySeconds: 60 });
    }
  }
}
