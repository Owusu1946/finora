import type { WebhookEvent } from '@clerk/backend/webhooks';

export type WelcomeEmailRecipient = {
  clerkUserId: string;
  recipientEmail: string;
  recipientName: string | null;
};

export function getWelcomeEmailRecipient(event: WebhookEvent): WelcomeEmailRecipient | null {
  if (event.type !== 'user.created' && event.type !== 'user.updated') return null;

  const primaryEmail = event.data.email_addresses.find(
    (email) =>
      email.id === event.data.primary_email_address_id && email.verification?.status === 'verified',
  );
  if (!primaryEmail) return null;

  const firstName = event.data.first_name?.trim() || null;
  return {
    clerkUserId: event.data.id,
    recipientEmail: primaryEmail.email_address,
    recipientName: firstName,
  };
}
