import type { WebhookEvent } from '@clerk/backend/webhooks';

import { describe, expect, it } from 'vitest';

import { getAllowedProviderSourceStatuses } from '../db/transactional-email-deliveries';
import { getWelcomeEmailRecipient } from './clerk-event';
import { isTransientResendError } from './consumer';
import { renderWelcomeEmail } from './welcome-email';

function userEvent(verificationStatus: 'verified' | 'unverified') {
  return {
    type: 'user.created',
    data: {
      id: 'user_123',
      first_name: 'Ama',
      primary_email_address_id: 'email_123',
      email_addresses: [
        {
          id: 'email_123',
          email_address: 'ama@example.com',
          verification: { status: verificationStatus },
        },
      ],
    },
  } as unknown as WebhookEvent;
}

describe('welcome email recipient selection', () => {
  it('uses only a verified primary email address', () => {
    expect(getWelcomeEmailRecipient(userEvent('verified'))).toEqual({
      clerkUserId: 'user_123',
      recipientEmail: 'ama@example.com',
      recipientName: 'Ama',
    });
    expect(getWelcomeEmailRecipient(userEvent('unverified'))).toBeNull();
  });
});

describe('welcome email rendering', () => {
  it('renders personalized HTML and plain text with the security notice', async () => {
    const rendered = await renderWelcomeEmail({
      firstName: 'Ama',
      ctaUrl: 'https://askorin.app',
    });

    expect(rendered.html).toContain('Welcome to Finora');
    expect(rendered.html).toContain(
      'https://finora-iota-ten.vercel.app/images/finora/email-logo.png',
    );
    expect(rendered.html).toContain('https://askorin.app');
    expect(rendered.text).toContain('Hi Ama');
    expect(rendered.text).toContain('ONE PLACE FOR YOUR FINANCIAL LIFE');
    expect(rendered.text).toContain('money never moves without policy checks');
    expect(rendered.text).toContain('never ask for your passcode, OTP, or recovery code');
    expect(rendered.text).toContain('transactional email');
  });
});

describe('Resend retry classification', () => {
  it('retries rate limits and provider failures only', () => {
    expect(isTransientResendError({ statusCode: 429 })).toBe(true);
    expect(isTransientResendError({ statusCode: 503 })).toBe(true);
    expect(isTransientResendError({ statusCode: 422 })).toBe(false);
    expect(isTransientResendError({ statusCode: null })).toBe(false);
  });
});

describe('provider delivery transitions', () => {
  it('does not let late sent or failed events downgrade terminal states', () => {
    expect(getAllowedProviderSourceStatuses('sent')).not.toContain('delivered');
    expect(getAllowedProviderSourceStatuses('failed')).not.toContain('delivered');
    expect(getAllowedProviderSourceStatuses('complained')).toContain('delivered');
  });
});
