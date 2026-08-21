import { and, eq, inArray, or, sql } from 'drizzle-orm';

import type { Database } from './client';

import { transactionalEmailDeliveries } from './schema';

export const welcomeEmailKind = 'welcome';

export type DeliveryStatus = typeof transactionalEmailDeliveries.$inferSelect.status;

type CreateWelcomeDeliveryInput = {
  clerkUserId: string;
  recipientEmail: string;
  recipientName: string | null;
};

export async function getOrCreateWelcomeDelivery(db: Database, input: CreateWelcomeDeliveryInput) {
  const [inserted] = await db
    .insert(transactionalEmailDeliveries)
    .values({ ...input, emailKind: welcomeEmailKind })
    .onConflictDoNothing({
      target: [transactionalEmailDeliveries.clerkUserId, transactionalEmailDeliveries.emailKind],
    })
    .returning();

  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(transactionalEmailDeliveries)
    .where(
      and(
        eq(transactionalEmailDeliveries.clerkUserId, input.clerkUserId),
        eq(transactionalEmailDeliveries.emailKind, welcomeEmailKind),
      ),
    )
    .limit(1);

  if (!existing) throw new Error('Welcome email delivery could not be created or loaded.');
  return existing;
}

export async function getTransactionalEmailDelivery(db: Database, deliveryId: string) {
  const [delivery] = await db
    .select()
    .from(transactionalEmailDeliveries)
    .where(eq(transactionalEmailDeliveries.id, deliveryId))
    .limit(1);
  return delivery ?? null;
}

export async function markDeliverySending(db: Database, deliveryId: string) {
  await db
    .update(transactionalEmailDeliveries)
    .set({
      status: 'sending',
      attemptCount: sql`${transactionalEmailDeliveries.attemptCount} + 1`,
      lastErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(transactionalEmailDeliveries.id, deliveryId));
}

export async function markDeliverySent(db: Database, deliveryId: string, resendEmailId: string) {
  await db
    .update(transactionalEmailDeliveries)
    .set({
      status: 'sent',
      resendEmailId,
      sentAt: new Date(),
      lastErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(transactionalEmailDeliveries.id, deliveryId));
}

export async function markDeliveryFailed(db: Database, deliveryId: string, errorCode: string) {
  await db
    .update(transactionalEmailDeliveries)
    .set({ status: 'failed', lastErrorCode: errorCode.slice(0, 120), updatedAt: new Date() })
    .where(eq(transactionalEmailDeliveries.id, deliveryId));
}

const terminalStatuses: DeliveryStatus[] = ['delivered', 'bounced', 'complained', 'suppressed'];

export function isTerminalDeliveryStatus(status: DeliveryStatus) {
  return terminalStatuses.includes(status);
}

export function getAllowedProviderSourceStatuses(status: DeliveryStatus): DeliveryStatus[] {
  switch (status) {
    case 'sent':
      return ['queued', 'sending', 'failed', 'sent'];
    case 'delayed':
      return ['queued', 'sending', 'sent', 'failed', 'delayed'];
    case 'delivered':
      return ['queued', 'sending', 'sent', 'failed', 'delayed', 'delivered'];
    case 'bounced':
    case 'suppressed':
      return ['queued', 'sending', 'sent', 'failed', 'delayed', status];
    case 'complained':
      return ['queued', 'sending', 'sent', 'failed', 'delayed', 'delivered', 'complained'];
    case 'failed':
      return ['queued', 'sending', 'sent', 'delayed', 'failed'];
    default:
      return [];
  }
}

export async function updateDeliveryFromProviderEvent(
  db: Database,
  resendEmailId: string,
  status: Extract<
    DeliveryStatus,
    'sent' | 'delivered' | 'delayed' | 'bounced' | 'complained' | 'suppressed' | 'failed'
  >,
  deliveryId?: string,
) {
  const now = new Date();
  await db
    .update(transactionalEmailDeliveries)
    .set({
      status,
      resendEmailId,
      sentAt: status === 'sent' ? now : undefined,
      deliveredAt: status === 'delivered' ? now : undefined,
      updatedAt: now,
    })
    .where(
      and(
        or(
          eq(transactionalEmailDeliveries.resendEmailId, resendEmailId),
          ...(deliveryId ? [eq(transactionalEmailDeliveries.id, deliveryId)] : []),
        ),
        inArray(transactionalEmailDeliveries.status, getAllowedProviderSourceStatuses(status)),
      ),
    );
}
