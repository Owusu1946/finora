import {
  PhoneVerificationCodeSchema,
  SEND_CORRIDORS,
  UpdateUserProfileSchema,
  normalizeGhanaPhoneNumber,
  normalizeFinoraTag,
  previewFxQuote,
  type Currency,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AuthenticatedUser } from '../auth';
import type { AppApiEnv } from '../env';

import { createDb } from '../db/client';
import {
  consumeRecoveryAttempt,
  deleteRecoveryChallenge,
  getActiveRecoveryChallenge,
  markRecoveryVerified,
  saveRecoveryChallenge,
} from '../db/passcode-recovery';
import {
  consumePhoneVerificationAttempt,
  deletePhoneVerificationChallenge,
  getPhoneVerificationChallenge,
  savePhoneVerificationChallenge,
} from '../db/phone-verification';
import {
  getUserProfileByClerkId,
  getUserProfileByPhoneNumber,
  searchUserProfilesByFinoraTag,
  setVerifiedPhoneNumber,
  upsertUserProfile,
} from '../db/user-profiles';
import { createPreparation, mockStore, newId } from '../mock/store';
import { PayrollPreparationError, preparePayrollImport } from '../payroll/prepare-import';
import { transcriptions } from './transcriptions';

type AppEnv = {
  Bindings: Env;
  Variables: { auth: AuthenticatedUser; env: AppApiEnv };
};

/**
 * Mock Finora platform routes.
 * Shape matches future live WeWire-backed handlers so MCP/mobile can stay stable.
 */
export const v1 = new Hono<AppEnv>();

v1.route('/transcriptions', transcriptions);

const RECOVERY_TTL_MS = 10 * 60_000;
const PHONE_VERIFICATION_TTL_MS = 10 * 60_000;
const SMS_RESEND_COOLDOWN_MS = 30_000;

async function hashOtp(env: Env, value: string) {
  if (!env.AGOO_SMS_API_KEY) throw new Error('SMS provider is not configured.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.AGOO_SMS_API_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateOtpCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0]! % 1_000_000).padStart(6, '0');
}

async function sendAgooSms(env: Env, to: string, message: string) {
  if (!env.AGOO_SMS_API_KEY) throw new Error('SMS provider is not configured.');
  const senderId = env.AGOO_SMS_SENDER_ID ?? 'VENTRAPOS';
  const requestBody = { to, message, senderId };
  console.log(
    '[Agoo SMS] Sending:',
    JSON.stringify({ to, senderId, messageLength: message.length }),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch('https://api.agoosms.com/v1/sms/send', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-API-Key': env.AGOO_SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('[Agoo SMS] Network/fetch error:', error);
    throw new Error(
      `SMS provider network error: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
  const rawText = await response.text().catch(() => '');
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    console.error('[Agoo SMS] Non-JSON response:', response.status, rawText.slice(0, 500));
  }
  console.log('[Agoo SMS] Response:', response.status, JSON.stringify(payload));
  if (!response.ok || !payload?.success) {
    console.error('[Agoo SMS] Rejected:', response.status, payload);
    throw new Error('SMS provider rejected the request.');
  }
}

v1.post('/auth/passcode-recovery/request', async (c) => {
  const { userId } = c.get('auth');
  const db = createDb(c.env.DATABASE_URL);
  const profile = await getUserProfileByClerkId(db, userId);
  const phoneNumber = profile?.phoneVerifiedAt ? profile.phoneNumber : null;
  if (!phoneNumber) {
    return c.json({ error: 'verified_phone_required' }, 422);
  }

  const previous = await getActiveRecoveryChallenge(db, userId);
  if (previous && Date.now() - previous.lastSentAt.getTime() < SMS_RESEND_COOLDOWN_MS) {
    return c.json({ error: 'sms_rate_limited', retryAfterSeconds: 30 }, 429);
  }

  const code = generateOtpCode();
  const challengeId = await saveRecoveryChallenge(db, {
    clerkUserId: userId,
    codeHash: await hashOtp(c.env, `${userId}:${code}`),
    expiresAt: new Date(Date.now() + RECOVERY_TTL_MS),
  });
  try {
    await sendAgooSms(
      c.env,
      phoneNumber,
      `Your Finora passcode reset code is ${code}. It expires in 10 minutes.`,
    );
  } catch {
    await deleteRecoveryChallenge(db, challengeId);
    return c.json({ error: 'sms_delivery_failed' }, 502);
  }

  return c.json({
    challengeId,
    expiresInSeconds: RECOVERY_TTL_MS / 1000,
    phoneHint: phoneNumber.slice(-4),
  });
});

v1.post('/auth/phone-verification/request', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    phoneNumber?: unknown;
    force?: unknown;
  } | null;
  if (typeof body?.phoneNumber !== 'string') {
    return c.json({ error: 'invalid_phone_number' }, 400);
  }
  const phoneNumber = normalizeGhanaPhoneNumber(body.phoneNumber);
  if (!phoneNumber) return c.json({ error: 'invalid_phone_number' }, 400);
  const force = body.force === true;

  const { userId } = c.get('auth');
  const db = createDb(c.env.DATABASE_URL);
  let profile = await getUserProfileByClerkId(db, userId);
  if (!profile) {
    const user = await c.get('clerk').users.getUser(userId);
    const primaryEmail =
      user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) return c.json({ error: 'profile_email_missing' }, 422);
    profile = await upsertUserProfile(db, {
      clerkUserId: user.id,
      email: primaryEmail,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        primaryEmail.split('@')[0] ||
        'Finora user',
      imageUrl: user.imageUrl || null,
    });
  }
  if (!force && profile.phoneNumber === phoneNumber && profile.phoneVerifiedAt) {
    console.log('[Phone Verify] Already verified, short-circuiting for', phoneNumber.slice(-4));
    return c.json({ verified: true, phoneHint: phoneNumber.slice(-4) });
  }
  const owner = await getUserProfileByPhoneNumber(db, phoneNumber);
  if (owner && owner.clerkUserId !== userId) {
    return c.json({ error: 'phone_number_in_use' }, 409);
  }

  const previous = await getPhoneVerificationChallenge(db, userId);
  if (previous && Date.now() - previous.lastSentAt.getTime() < SMS_RESEND_COOLDOWN_MS) {
    return c.json({ error: 'sms_rate_limited', retryAfterSeconds: 30 }, 429);
  }

  const code = generateOtpCode();
  console.log('[Phone Verify] Generated OTP for', phoneNumber.slice(-4));
  const challengeId = await savePhoneVerificationChallenge(db, {
    clerkUserId: userId,
    phoneNumber,
    codeHash: await hashOtp(c.env, `${userId}:${phoneNumber}:${code}`),
    expiresAt: new Date(Date.now() + PHONE_VERIFICATION_TTL_MS),
  });
  try {
    await sendAgooSms(
      c.env,
      phoneNumber,
      `Your Finora phone verification code is ${code}. It expires in 10 minutes.`,
    );
  } catch (smsError) {
    console.error('[Phone Verify] SMS delivery failed:', smsError);
    await deletePhoneVerificationChallenge(db, challengeId);
    return c.json({ error: 'sms_delivery_failed' }, 502);
  }

  return c.json({
    challengeId,
    expiresInSeconds: PHONE_VERIFICATION_TTL_MS / 1000,
    phoneHint: phoneNumber.slice(-4),
  });
});

v1.post('/auth/phone-verification/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
  const code = PhoneVerificationCodeSchema.safeParse(body?.code);
  if (!code.success) {
    return c.json({ error: 'invalid_code' }, 400);
  }

  const { userId } = c.get('auth');
  const db = createDb(c.env.DATABASE_URL);
  const challenge = await consumePhoneVerificationAttempt(db, userId);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    const profile = await getUserProfileByClerkId(db, userId);
    if (profile?.phoneNumber && profile?.phoneVerifiedAt) {
      return c.json({ verified: true, profile });
    }
    return c.json({ error: 'verification_code_expired' }, 410);
  }
  const valid =
    (await hashOtp(c.env, `${userId}:${challenge.phoneNumber}:${code.data}`)) ===
    challenge.codeHash;
  if (!valid) return c.json({ error: 'invalid_code' }, 400);

  try {
    let profile = await getUserProfileByClerkId(db, userId);
    if (!profile) {
      const user = await c.get('clerk').users.getUser(userId);
      const primaryEmail =
        user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
          ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (!primaryEmail) return c.json({ error: 'profile_email_missing' }, 422);
      profile = await upsertUserProfile(db, {
        clerkUserId: user.id,
        email: primaryEmail,
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          primaryEmail.split('@')[0] ||
          'Finora user',
        imageUrl: user.imageUrl || null,
      });
    }
    const updatedProfile = await setVerifiedPhoneNumber(db, userId, challenge.phoneNumber);
    await deletePhoneVerificationChallenge(db, challenge.id);
    return c.json({ verified: true, profile: updatedProfile });
  } catch (error) {
    console.error('Phone verification verify error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return c.json({ error: 'phone_number_in_use' }, 409);
    }
    throw error;
  }
});

v1.post('/auth/passcode-recovery/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
  const code = PhoneVerificationCodeSchema.safeParse(body?.code);
  if (!code.success) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  const { userId } = c.get('auth');
  const challenge = await consumeRecoveryAttempt(createDb(c.env.DATABASE_URL), userId);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.verifiedAt) {
    return c.json({ error: 'recovery_code_expired' }, 410);
  }
  const valid = (await hashOtp(c.env, `${userId}:${code.data}`)) === challenge.codeHash;
  if (!valid) return c.json({ error: 'invalid_code' }, 400);
  await markRecoveryVerified(createDb(c.env.DATABASE_URL), challenge.id);
  return c.json({ verified: true });
});

v1.get('/auth/me', async (c) => {
  const { userId } = c.get('auth');
  const clerk = c.get('clerk');
  const user = await clerk.users.getUser(userId);
  const primaryEmail =
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) return c.json({ error: 'profile_email_missing' }, 422);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    primaryEmail.split('@')[0] ||
    'Finora user';
  const profile = await upsertUserProfile(createDb(c.get('env').DATABASE_URL), {
    clerkUserId: user.id,
    email: primaryEmail,
    displayName,
    imageUrl: user.imageUrl || null,
  });

  return c.json({ profile });
});

v1.patch('/auth/me', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateUserProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }

  const { userId } = c.get('auth');
  const clerk = c.get('clerk');
  const user = await clerk.users.getUser(userId);
  const primaryEmail =
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) return c.json({ error: 'profile_email_missing' }, 422);

  try {
    const profile = await upsertUserProfile(createDb(c.get('env').DATABASE_URL), {
      clerkUserId: user.id,
      email: primaryEmail,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        primaryEmail.split('@')[0] ||
        'Finora user',
      imageUrl: user.imageUrl || null,
      ...parsed.data,
    });
    return c.json({ profile });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return c.json({ error: 'finora_tag_taken' }, 409);
    }
    throw error;
  }
});

function publicFinoraAccount(account: (typeof mockStore.subcustomers)[number]) {
  return {
    accountId: `acct_${account.id}`,
    subCustomerId: account.id,
    tag: account.finoraTag,
    displayName:
      account.businessName ?? [account.firstName, account.lastName].filter(Boolean).join(' '),
    country: account.country,
    status: account.status === 'ACTIVE' ? 'active' : 'suspended',
    walletCurrencies: account.walletCurrencies,
  };
}

// ─── Balances / wallets / receive ──────────────────────────────────────────

v1.get('/balances', (c) => {
  const balances = mockStore.wallets.map((w) => ({
    id: w.id,
    currency: w.currency,
    balance: Number(w.balance),
    status: w.status,
    subCustomerId: w.subCustomerId,
  }));
  return c.json({
    mode: 'mock',
    totalUsd: balances
      .filter((b) => b.currency === 'USD' || b.currency === 'USDT' || b.currency === 'USDC')
      .reduce((s, b) => s + b.balance, 0),
    balances,
  });
});

v1.get('/wallets', (c) => {
  const subCustomerId = c.req.query('subCustomerId');
  const currency = c.req.query('currency');
  const query = (c.req.query('query') ?? '').toLowerCase();
  let wallets = [...mockStore.wallets];
  if (subCustomerId) wallets = wallets.filter((w) => w.subCustomerId === subCustomerId);
  if (currency) wallets = wallets.filter((w) => w.currency === currency);
  if (query) {
    wallets = wallets.filter(
      (w) =>
        w.currency.toLowerCase().includes(query) ||
        w.id.toLowerCase().includes(query) ||
        (w.subCustomerId?.toLowerCase().includes(query) ?? false),
    );
  }
  return c.json({ mode: 'mock', wallets });
});

v1.get('/receive-methods', (c) => {
  return c.json({
    mode: 'mock',
    methods: [
      {
        id: 'va-usd',
        kind: 'virtual_account',
        currency: 'USD',
        title: 'USD virtual account',
        fields: [
          { label: 'IBAN', value: 'GB82 CLRB 0406 6800 0123 45' },
          { label: 'BIC', value: 'CLRBGB22' },
        ],
      },
      {
        id: 'momo-ghs',
        kind: 'mobile_money',
        currency: 'GHS',
        title: 'MTN MoMo collection',
        fields: [
          { label: 'Network', value: 'MTN' },
          { label: 'Number', value: '0550123456' },
        ],
      },
      {
        id: 'crypto-usdt',
        kind: 'crypto',
        currency: 'USDT',
        network: 'TRON',
        title: 'USDT · TRC-20',
        fields: [{ label: 'Address', value: 'TXyzFinoraMockDepositAddress9hQ2' }],
      },
    ],
  });
});

v1.get('/virtual-accounts', (c) =>
  c.json({
    mode: 'mock',
    accounts: [
      {
        id: 'va-usd',
        currency: 'USD',
        iban: 'GB82 CLRB 0406 6800 0123 45',
        bic: 'CLRBGB22',
        status: 'ACTIVE',
      },
    ],
  }),
);

v1.get('/crypto-addresses', (c) =>
  c.json({
    mode: 'mock',
    addresses: [
      {
        id: 'ca-usdt',
        currency: 'USDT',
        network: 'TRON',
        address: 'TXyzFinoraMockDepositAddress9hQ2',
        status: 'ACTIVE',
      },
    ],
  }),
);

// ─── Contacts ──────────────────────────────────────────────────────────────

v1.get('/contacts', (c) => {
  const q = (c.req.query('query') ?? '').toLowerCase();
  const favouriteOnly = c.req.query('favouriteOnly') === 'true';
  let items = [...mockStore.contacts];
  if (favouriteOnly) items = items.filter((x) => x.favourite);
  if (q) {
    items = items.filter(
      (x) => x.name.toLowerCase().includes(q) || x.identifier.toLowerCase().includes(q),
    );
  }
  return c.json({ mode: 'mock', contacts: items });
});

v1.post('/contacts', async (c) => {
  const body = await c.req.json<{
    name: string;
    method: string;
    identifier: string;
    currency?: string;
    favourite?: boolean;
  }>();
  const contact = {
    id: newId('c'),
    name: body.name,
    method: body.method,
    identifier: body.identifier,
    currency: body.currency ?? 'USD',
    favourite: body.favourite ?? false,
  };
  mockStore.contacts.unshift(contact);
  return c.json({ mode: 'mock', contact }, 201);
});

v1.post('/accounts/lookup', async (c) => {
  const body = await c.req.json<{ kind: string; value: string }>();
  if (body.kind === 'internal_wallet') {
    const tag = normalizeFinoraTag(body.value);
    const account = mockStore.subcustomers.find(
      (item) =>
        item.finoraTag === tag && item.status === 'ACTIVE' && item.onboardingStatus === 'APPROVED',
    );
    if (!account) return c.json({ error: 'finora_tag_not_found' }, 404);
    return c.json({ mode: 'mock', kind: body.kind, account: publicFinoraAccount(account) });
  }
  return c.json({
    mode: 'mock',
    kind: body.kind,
    value: body.value,
    resolvedName: body.kind === 'mobile_money' ? 'Mobile money recipient' : 'Account holder',
    status: 'resolvable',
  });
});

v1.get('/finora-tags/search', async (c) => {
  const query = normalizeFinoraTag(c.req.query('query') ?? '');
  if (query.length < 3) {
    return c.json({ mode: 'live', accounts: [], reason: 'query_too_short' });
  }

  const { userId } = c.get('auth');
  const profiles = await searchUserProfilesByFinoraTag(
    createDb(c.get('env').DATABASE_URL),
    userId,
    query,
  );

  return c.json({
    mode: 'live',
    accounts: profiles.flatMap((profile) =>
      profile.finoraTag
        ? [
            {
              accountId: `profile_${profile.id}`,
              subCustomerId: profile.id,
              tag: profile.finoraTag,
              displayName: profile.displayName,
              country: 'GH',
              status: 'active' as const,
              walletCurrencies: ['GHS'],
            },
          ]
        : [],
    ),
  });
});

v1.get('/finora-tags/:tag', (c) => {
  const tag = normalizeFinoraTag(c.req.param('tag'));
  const account = mockStore.subcustomers.find(
    (item) =>
      item.finoraTag === tag && item.status === 'ACTIVE' && item.onboardingStatus === 'APPROVED',
  );
  if (!account) return c.json({ error: 'finora_tag_not_found' }, 404);
  if (account.id === 'sc_personal_001') return c.json({ error: 'self_transfer' }, 409);
  return c.json({ mode: 'mock', account: publicFinoraAccount(account) });
});

// ─── Preparations (money movement → approval) ──────────────────────────────

v1.post('/payments/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  // Accepts international fields (destinationCountry, settlementMethod, purposeCode,
  // rail details, fundingCurrency, fx) and stores them on the preparation payload.
  return c.json(
    createPreparation('payment', {
      ...body,
      corridor:
        typeof body.destinationCountry === 'string'
          ? SEND_CORRIDORS.find((x) => x.code === body.destinationCountry)
          : undefined,
    }),
    201,
  );
});

v1.post('/disbursements/mobile-money/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('momo_disbursement', body), 201);
});

v1.post('/transfers/prepare', async (c) => {
  const body = await c.req.json<{
    fromSubCustomerId?: string;
    toSubCustomerId?: string;
    amount?: { value?: number; currency?: string };
    reference?: string;
  }>();
  if (
    !body.fromSubCustomerId ||
    !body.toSubCustomerId ||
    body.fromSubCustomerId === body.toSubCustomerId
  ) {
    return c.json({ error: 'invalid_internal_transfer_accounts' }, 400);
  }
  const recipient = mockStore.subcustomers.find(
    (item) =>
      item.id === body.toSubCustomerId &&
      item.status === 'ACTIVE' &&
      item.onboardingStatus === 'APPROVED',
  );
  if (!recipient) return c.json({ error: 'recipient_not_found' }, 404);
  const currency = body.amount?.currency?.toUpperCase();
  if (!body.amount?.value || body.amount.value <= 0 || !currency) {
    return c.json({ error: 'invalid_amount' }, 400);
  }
  if (!recipient.walletCurrencies.includes(currency)) {
    return c.json(
      { error: 'recipient_wallet_unavailable', available: recipient.walletCurrencies },
      409,
    );
  }
  return c.json(
    createPreparation('internal_transfer', {
      ...body,
      recipient: publicFinoraAccount(recipient),
    }),
    201,
  );
});

v1.post('/conversions/prepare', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const rate = mockStore.fxRates.find((r) => r.from === body.from && r.to === body.to)?.rate ?? 1;
  const fee = Number((body.amount * 0.004).toFixed(2));
  const toAmount = Number(((body.amount - fee) * rate).toFixed(2));
  return c.json(
    createPreparation('conversion', {
      ...body,
      rate,
      fee,
      toAmount,
      quoteId: newId('quote'),
    }),
    201,
  );
});

// ─── Approvals ─────────────────────────────────────────────────────────────

v1.get('/approvals', (c) => {
  const status = c.req.query('status') ?? 'pending';
  const items =
    status === 'all' ? mockStore.approvals : mockStore.approvals.filter((a) => a.status === status);
  return c.json({ mode: 'mock', approvals: items });
});

v1.get('/approvals/:id', (c) => {
  const item = mockStore.approvals.find(
    (a) => a.id === c.req.param('id') || a.preparationId === c.req.param('id'),
  );
  if (!item) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', approval: item });
});

v1.post('/approvals/request', async (c) => {
  const body = await c.req.json<{ preparationId: string; note?: string }>();
  const item = mockStore.approvals.find((a) => a.preparationId === body.preparationId);
  if (!item) return c.json({ error: 'preparation_not_found' }, 404);
  return c.json({
    mode: 'mock',
    approvalId: item.id,
    status: item.status,
    push: 'queued',
    note: body.note,
    message: 'Human notified in Finora Approvals inbox.',
  });
});

/** Human app only — MCP must not call this to move money. */
v1.post('/approvals/:id/resolve', async (c) => {
  const body = await c.req.json<{ decision: 'approved' | 'rejected' }>();
  const item = mockStore.approvals.find((a) => a.id === c.req.param('id'));
  if (!item) return c.json({ error: 'not_found' }, 404);
  item.status = body.decision;
  item.resolvedAt = new Date().toISOString();
  if (body.decision === 'approved') {
    const txId = newId('WW');
    item.transactionId = txId;
    item.status = 'executed';
    mockStore.transactions.unshift({
      id: newId('tx'),
      wewireId: txId,
      type:
        item.kind === 'conversion'
          ? 'CONVERSION'
          : item.kind === 'momo_disbursement'
            ? 'DISBURSEMENT'
            : 'PAYOUT',
      channel:
        item.kind === 'momo_disbursement'
          ? 'MOBILE_MONEY'
          : item.kind === 'conversion'
            ? 'FX'
            : item.kind === 'internal_transfer'
              ? 'INTERNAL'
              : 'BANK',
      status: 'COMPLETED',
      amount: String((item.payload as { amount?: number }).amount ?? 0),
      currency: String((item.payload as { currency?: string }).currency ?? 'USD'),
      counterparty: String(
        (item.payload as { recipientName?: string }).recipientName ?? 'Counterparty',
      ),
      reference: String((item.payload as { reference?: string }).reference ?? item.preparationId),
      subCustomerId: 'sc_personal_001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return c.json({ mode: 'mock', approval: item });
});

// ─── Transactions ──────────────────────────────────────────────────────────

v1.get('/transactions', (c) => {
  const type = c.req.query('type');
  const status = c.req.query('status');
  const limit = Number(c.req.query('limit') ?? 50);
  const query = (c.req.query('query') ?? '').toLowerCase();
  let items = [...mockStore.transactions];
  if (type) items = items.filter((t) => t.type === type);
  if (status) items = items.filter((t) => t.status === status);
  if (query) {
    items = items.filter(
      (t) =>
        t.counterparty.toLowerCase().includes(query) ||
        t.reference.toLowerCase().includes(query) ||
        t.wewireId.toLowerCase().includes(query),
    );
  }
  return c.json({ mode: 'mock', transactions: items.slice(0, limit) });
});

v1.get('/transactions/search', (c) => {
  const q = (c.req.query('query') ?? '').toLowerCase();
  const items = mockStore.transactions.filter(
    (t) =>
      t.counterparty.toLowerCase().includes(q) ||
      t.reference.toLowerCase().includes(q) ||
      t.wewireId.toLowerCase().includes(q),
  );
  return c.json({ mode: 'mock', transactions: items });
});

v1.get('/transactions/:id', (c) => {
  const id = c.req.param('id');
  const item = mockStore.transactions.find((t) => t.id === id || t.wewireId === id);
  if (!item) return c.json({ error: 'not_found' }, 404);
  return c.json({
    mode: 'mock',
    transaction: item,
    timeline: [
      { id: 'prepared', label: 'Prepared', status: 'done', at: item.createdAt },
      { id: 'approved', label: 'Approved', status: 'done', at: item.createdAt },
      {
        id: 'settled',
        label: item.status === 'FAILED' ? 'Failed' : 'Settled',
        status: item.status === 'PROCESSING' ? 'active' : 'done',
        at: item.updatedAt,
      },
    ],
  });
});

// ─── FX ────────────────────────────────────────────────────────────────────

v1.get('/rates', (c) => c.json({ mode: 'mock', rates: mockStore.fxRates }));

v1.get('/rates/:from/:to', (c) => {
  const from = c.req.param('from').toUpperCase();
  const to = c.req.param('to').toUpperCase();
  const rate = mockStore.fxRates.find((r) => r.from === from && r.to === to);
  if (!rate) return c.json({ error: 'pair_not_found' }, 404);
  return c.json({ mode: 'mock', rate });
});

v1.post('/conversions/preview', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const rate = mockStore.fxRates.find((r) => r.from === body.from && r.to === body.to)?.rate ?? 1;
  const fee = Number((body.amount * 0.004).toFixed(2));
  const toAmount = Number(((body.amount - fee) * rate).toFixed(2));
  return c.json({
    mode: 'mock',
    from: body.from,
    to: body.to,
    fromAmount: body.amount,
    toAmount,
    rate,
    fee,
    feeCurrency: body.from,
    quoteId: newId('quote'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
});

// ─── Sub-customers ─────────────────────────────────────────────────────────

v1.get('/subcustomers', (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');
  let items = [...mockStore.subcustomers];
  if (status) items = items.filter((s) => s.status === status);
  if (type) items = items.filter((s) => s.type === type);
  return c.json({ mode: 'mock', subcustomers: items });
});

v1.post('/subcustomers', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const requestedTag = normalizeFinoraTag(
    String(body.finoraTag ?? body.email ?? `finora${Date.now()}`),
  );
  if (mockStore.subcustomers.some((item) => item.finoraTag === requestedTag)) {
    return c.json({ error: 'finora_tag_unavailable' }, 409);
  }
  const sc = {
    id: newId('sc'),
    finoraTag: requestedTag,
    type: (body.type as 'INDIVIDUAL' | 'BUSINESS') ?? 'INDIVIDUAL',
    email: String(body.email ?? ''),
    country: String(body.country ?? 'GH'),
    firstName: body.firstName as string | undefined,
    lastName: body.lastName as string | undefined,
    businessName: body.businessName as string | undefined,
    status: 'ACTIVE' as const,
    walletCurrencies: (body.walletCurrencies as string[] | undefined) ?? ['USD'],
    onboardingStatus: 'NOT_STARTED' as const,
    purpose: (body.purpose as 'PAYMENTS'[]) ?? ['PAYMENTS'],
    createdAt: new Date().toISOString(),
  };
  mockStore.subcustomers.unshift(sc);
  return c.json({ mode: 'mock', subcustomer: sc }, 201);
});

v1.get('/subcustomers/:id', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', subcustomer: sc });
});

v1.patch('/subcustomers/:id/archive', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.status = 'ARCHIVED';
  return c.json({ mode: 'mock', subcustomer: sc });
});

// ─── KYC ───────────────────────────────────────────────────────────────────

v1.post('/subcustomers/:id/kyc', async (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.onboardingStatus = 'IN_PROGRESS';
  return c.json({ mode: 'mock', status: 'IN_PROGRESS', subCustomerId: sc.id });
});

v1.get('/subcustomers/:id/kyc-link', (c) => {
  const id = c.req.param('id');
  return c.json({
    mode: 'mock',
    url: `https://kyc.wewire.example/start?subCustomerId=${id}&token=mock`,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
});

v1.get('/subcustomers/:id/kyc/requirements', (c) => {
  const id = c.req.param('id');
  const kyc = mockStore.kyc[id];
  return c.json({
    mode: 'mock',
    requirements: kyc?.requirements ?? [
      { id: 'id', label: 'Government ID', required: true, status: 'missing' },
    ],
  });
});

v1.post('/subcustomers/:id/kyc/beneficial-owners', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ fullName: string; ownershipPercent: number }>();
  const bucket = mockStore.kyc[id] ?? {
    requirements: [],
    beneficialOwners: [],
  };
  const owner = { id: newId('ubo'), ...body };
  bucket.beneficialOwners.push(owner);
  mockStore.kyc[id] = bucket;
  return c.json({ mode: 'mock', owner }, 201);
});

v1.post('/subcustomers/:id/kyc/submit', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.onboardingStatus = 'PENDING_REVIEW';
  return c.json({ mode: 'mock', status: 'PENDING_REVIEW' });
});

// ─── Invoices ──────────────────────────────────────────────────────────────

v1.get('/invoices', (c) => {
  const status = c.req.query('status');
  const query = (c.req.query('query') ?? '').toLowerCase();
  let items = [...mockStore.invoices];
  if (status && status !== 'all') items = items.filter((i) => i.status === status);
  if (query) {
    items = items.filter(
      (i) =>
        i.vendor.toLowerCase().includes(query) || i.invoiceNumber.toLowerCase().includes(query),
    );
  }
  return c.json({ mode: 'mock', invoices: items });
});

v1.get('/invoices/:id', (c) => {
  const inv = mockStore.invoices.find((i) => i.id === c.req.param('id'));
  if (!inv) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', invoice: inv });
});

v1.post('/invoices/:id/prepare-payment', (c) => {
  const inv = mockStore.invoices.find((i) => i.id === c.req.param('id'));
  if (!inv) return c.json({ error: 'not_found' }, 404);
  return c.json(
    createPreparation('invoice_payment', {
      invoiceId: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      recipientName: inv.vendor,
      reference: inv.invoiceNumber,
    }),
    201,
  );
});

// ─── Recurring ─────────────────────────────────────────────────────────────

v1.get('/recurring', (c) => {
  const status = c.req.query('status');
  let items = [...mockStore.recurring];
  if (status && status !== 'all') items = items.filter((r) => r.status === status);
  return c.json({ mode: 'mock', recurring: items });
});

v1.post('/recurring/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('recurring', body), 201);
});

v1.patch('/recurring/:id', async (c) => {
  const body = await c.req.json<{ status: 'active' | 'paused' | 'cancelled' }>();
  const item = mockStore.recurring.find((r) => r.id === c.req.param('id'));
  if (!item) return c.json({ error: 'not_found' }, 404);
  item.status = body.status;
  return c.json({ mode: 'mock', recurring: item });
});

// ─── Extra wallet / currency stubs ─────────────────────────────────────────

v1.get('/wallets/:id/limits', (c) => {
  const wallet = mockStore.wallets.find((w) => w.id === c.req.param('id'));
  if (!wallet) return c.json({ error: 'not_found' }, 404);
  return c.json({
    mode: 'mock',
    walletId: wallet.id,
    currency: wallet.currency,
    dailySendLimit: 10_000,
    dailyReceiveLimit: 50_000,
    perTxLimit: 5_000,
  });
});

v1.get('/wallets/:id', (c) => {
  const wallet = mockStore.wallets.find((w) => w.id === c.req.param('id'));
  if (!wallet) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', wallet });
});

v1.get('/currencies', (c) =>
  c.json({
    mode: 'mock',
    currencies: ['USD', 'GHS', 'EUR', 'GBP', 'USDT', 'USDC'],
  }),
);

v1.post('/wallets/transfer/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('wallet_transfer', body), 201);
});

v1.get('/virtual-accounts/:id', (c) => {
  const accounts = [
    {
      id: 'va-usd',
      currency: 'USD',
      iban: 'GB82 CLRB 0406 6800 0123 45',
      bic: 'CLRBGB22',
      status: 'ACTIVE',
    },
  ];
  const account = accounts.find((a) => a.id === c.req.param('id'));
  if (!account) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', account });
});

v1.get('/crypto-wallets/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    mode: 'mock',
    wallet: {
      id: id.startsWith('ca-') ? id : 'ca-usdt',
      currency: id === 'USDC' ? 'USDC' : 'USDT',
      network: 'TRON',
      address: 'TXyzFinoraMockDepositAddress9hQ2',
      status: 'ACTIVE',
    },
  });
});

v1.post('/crypto/validate-address', async (c) => {
  const body = await c.req.json<{ address: string; currency?: string; network?: string }>();
  return c.json({
    mode: 'mock',
    address: body.address,
    valid: body.address.length >= 20,
    currency: body.currency ?? 'USDT',
    network: body.network ?? 'TRON',
  });
});

v1.post('/payment-requests', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const prep = createPreparation('payment_request', body);
  const link = `https://pay.finora.app/r/${prep.preparationId}`;
  return c.json(
    {
      ...prep,
      link,
      qrPayload: link,
      amount: body.amount ?? null,
      currency: body.currency ?? null,
      memo: body.memo ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    201,
  );
});

// ─── Beneficiaries / recipients ────────────────────────────────────────────

v1.get('/beneficiaries', (c) => c.json({ mode: 'mock', beneficiaries: mockStore.beneficiaries }));

v1.post('/beneficiaries/verify', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json({ mode: 'mock', verified: true, ...body });
});

v1.post('/accounts/lookup/bank', async (c) => {
  const body = await c.req.json<{ accountNumber?: string; value?: string }>();
  return c.json({
    mode: 'mock',
    kind: 'bank',
    value: body.accountNumber ?? body.value,
    resolvedName: 'Bank account holder',
    status: 'resolvable',
  });
});

v1.post('/accounts/lookup/mobile-money', async (c) => {
  const body = await c.req.json<{ phone?: string; value?: string }>();
  return c.json({
    mode: 'mock',
    kind: 'mobile_money',
    value: body.phone ?? body.value,
    resolvedName: 'Mobile money recipient',
    status: 'resolvable',
  });
});

v1.post('/accounts/lookup/crypto', async (c) => {
  const body = await c.req.json<{ address?: string; value?: string }>();
  return c.json({
    mode: 'mock',
    kind: 'crypto',
    value: body.address ?? body.value,
    resolvedName: null,
    status: 'resolvable',
  });
});

v1.get('/recipients/resolve', (c) => {
  const q = (c.req.query('query') ?? '').toLowerCase();
  const matches = mockStore.contacts.filter((x) => x.name.toLowerCase().includes(q));
  return c.json({
    mode: 'mock',
    query: q,
    matches,
    ambiguous: matches.length > 1,
  });
});

v1.post('/recipients/resolve-duplicates', async (c) => {
  const body = await c.req.json<{ query?: string; selectedId?: string }>();
  const contact = mockStore.contacts.find((x) => x.id === body.selectedId);
  return c.json({ mode: 'mock', selected: contact ?? null, query: body.query });
});

v1.get('/recipients/search', (c) => {
  const q = (c.req.query('query') ?? '').toLowerCase();
  const contacts = mockStore.contacts.filter(
    (x) => x.name.toLowerCase().includes(q) || x.identifier.toLowerCase().includes(q),
  );
  return c.json({ mode: 'mock', recipients: contacts });
});

// ─── Payment helpers / more prepares ───────────────────────────────────────

v1.post('/payments/preview', async (c) => {
  const body = await c.req.json<{ amount?: number; currency?: string; method?: string }>();
  const amount = Number(body.amount ?? 0);
  const fee = Number((amount * 0.005).toFixed(2));
  return c.json({
    mode: 'mock',
    amount,
    currency: body.currency ?? 'USD',
    method: body.method ?? 'bank',
    fee,
    total: amount + fee,
  });
});

v1.post('/transfers/bank/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('bank_transfer', body), 201);
});

v1.post('/crypto/usdt/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('usdt_transfer', body), 201);
});

v1.post('/crypto/usdc/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('usdc_transfer', body), 201);
});

v1.post('/preparations/cancel', async (c) => {
  const body = await c.req.json<{ preparationId: string }>();
  const item = mockStore.approvals.find(
    (a) => a.preparationId === body.preparationId || a.id === body.preparationId,
  );
  if (!item) return c.json({ error: 'preparation_not_found' }, 404);
  if (item.status !== 'pending') {
    return c.json({ error: 'not_cancellable', status: item.status }, 409);
  }
  item.status = 'cancelled';
  item.resolvedAt = new Date().toISOString();
  return c.json({ mode: 'mock', cancelled: true, approval: item });
});

v1.post('/payments/estimate-fees', async (c) => {
  const body = await c.req.json<{ amount?: number }>();
  const amount = Number(body.amount ?? 0);
  return c.json({ mode: 'mock', fee: Number((amount * 0.005).toFixed(2)), currency: 'USD' });
});

v1.post('/payments/estimate-delivery', async (c) => {
  const body = await c.req.json<{ method?: string }>();
  return c.json({
    mode: 'mock',
    method: body.method ?? 'bank',
    etaMinutes: body.method === 'mobile_money' ? 5 : 60,
  });
});

v1.post('/crypto/estimate-network-fee', async (c) => {
  const body = await c.req.json<{ currency?: string; network?: string }>();
  return c.json({
    mode: 'mock',
    currency: body.currency ?? 'USDT',
    network: body.network ?? 'TRON',
    networkFee: 1.25,
    feeCurrency: 'USDT',
  });
});

v1.post('/accounts/verify/bank', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json({ mode: 'mock', verified: true, ...body });
});

v1.post('/accounts/verify/mobile-money', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json({ mode: 'mock', verified: true, ...body });
});

v1.get('/banks', (c) =>
  c.json({
    mode: 'mock',
    country: c.req.query('country') ?? 'GH',
    banks: [
      { id: 'gcb', name: 'GCB Bank' },
      { id: 'absa', name: 'Absa Ghana' },
      { id: 'ecobank', name: 'Ecobank' },
    ],
  }),
);

v1.get('/momo-networks', (c) =>
  c.json({
    mode: 'mock',
    country: c.req.query('country') ?? 'GH',
    networks: [
      { id: 'mtn', name: 'MTN MoMo' },
      { id: 'vodafone', name: 'Telecel Cash' },
      { id: 'airteltigo', name: 'AirtelTigo Money' },
    ],
  }),
);

v1.post('/approvals', async (c) => {
  const body = await c.req.json<{ preparationId?: string; note?: string }>();
  if (body.preparationId) {
    const item = mockStore.approvals.find((a) => a.preparationId === body.preparationId);
    if (!item) return c.json({ error: 'preparation_not_found' }, 404);
    return c.json({ mode: 'mock', approvalId: item.id, status: item.status, note: body.note });
  }
  return c.json(createPreparation('payment', { note: body.note }), 201);
});

// ─── Transaction search / filter ───────────────────────────────────────────

v1.post('/transactions/filter', async (c) => {
  const body = await c.req.json<{ type?: string; status?: string; limit?: number }>();
  let items = [...mockStore.transactions];
  if (body.type) items = items.filter((t) => t.type === body.type);
  if (body.status) items = items.filter((t) => t.status === body.status);
  return c.json({ mode: 'mock', transactions: items.slice(0, body.limit ?? 50) });
});

// ─── KYC start / status ────────────────────────────────────────────────────

v1.post('/subcustomers/:id/kyc/start', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.onboardingStatus = 'IN_PROGRESS';
  return c.json({ mode: 'mock', status: 'IN_PROGRESS', subCustomerId: sc.id });
});

v1.get('/subcustomers/:id/kyc/status', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  return c.json({
    mode: 'mock',
    subCustomerId: sc.id,
    onboardingStatus: sc.onboardingStatus,
    status: sc.onboardingStatus,
  });
});

// ─── Invoices scan ─────────────────────────────────────────────────────────

v1.post('/invoices/scan', async (c) => {
  return c.json({
    mode: 'mock',
    scanned: mockStore.invoices.length,
    invoices: mockStore.invoices.filter((i) => i.status === 'due'),
  });
});

// ─── Business: suppliers / payroll ─────────────────────────────────────────

v1.get('/suppliers', (c) => c.json({ mode: 'mock', suppliers: mockStore.suppliers }));

v1.post('/suppliers/prepare-payment', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('supplier_payment', body), 201);
});

v1.get('/employees', (c) => c.json({ mode: 'mock', employees: mockStore.employees }));

v1.post('/payroll/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.importId !== 'string') {
    return c.json(
      {
        error: 'payroll_import_required',
        message: 'Payroll must be imported and validated before preparation.',
      },
      409,
    );
  }
  try {
    return c.json(
      await preparePayrollImport({
        databaseUrl: c.get('env').DATABASE_URL,
        userId: c.get('auth').userId,
        importId: body.importId,
        period: typeof body.period === 'string' ? body.period : undefined,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof PayrollPreparationError) {
      return c.json({ error: error.code, ...error.details }, error.status);
    }
    throw error;
  }
});

// ─── Notifications / integrations ──────────────────────────────────────────

v1.get('/notifications', (c) => {
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  let items = [...mockStore.notifications];
  if (unreadOnly) items = items.filter((n) => n.unread);
  return c.json({ mode: 'mock', notifications: items });
});

v1.get('/integrations', (c) => c.json({ mode: 'mock', integrations: mockStore.integrations }));

// ─── Policy ────────────────────────────────────────────────────────────────

v1.get('/policies', (c) => c.json({ mode: 'mock', policies: mockStore.policies }));

v1.post('/policies/check', async (c) => {
  const body = await c.req.json<{
    action: string;
    amount?: number;
    destinationValue?: string;
  }>();
  const amount = Number(body.amount ?? 0);
  const requiresApproval = amount > 500 || Boolean(body.destinationValue);
  return c.json({
    mode: 'mock',
    action: body.action,
    allowed: true,
    requiresApproval,
    matchedPolicies: mockStore.policies.filter((p) => p.enabled).map((p) => p.id),
    message: requiresApproval
      ? 'Allowed after human approval in Finora Approvals inbox.'
      : 'Allowed under current policy.',
  });
});

// ─── Intelligence stubs ────────────────────────────────────────────────────

v1.post('/intelligence/recommend-rail', async (c) => {
  const body = await c.req.json<{ amount?: number; currency?: string; country?: string }>();
  const rail = body.currency === 'GHS' || body.country === 'GH' ? 'mobile_money' : 'bank';
  return c.json({
    mode: 'mock',
    recommended: rail,
    reason: 'Fastest available rail for destination',
  });
});

v1.post('/intelligence/cheapest-rail', async (c) => {
  return c.json({ mode: 'mock', recommended: 'mobile_money', estimatedFee: 0.5 });
});

v1.post('/intelligence/detect-duplicates', async (c) => {
  const body = await c.req.json<{ amount?: number; destinationValue?: string }>();
  const hits = mockStore.transactions.filter(
    (t) =>
      Number(t.amount) === Number(body.amount ?? -1) ||
      (body.destinationValue &&
        t.counterparty.toLowerCase().includes(String(body.destinationValue).toLowerCase())),
  );
  return c.json({
    mode: 'mock',
    duplicates: hits.slice(0, 3),
    likelyDuplicate: hits.length > 0,
  });
});

v1.post('/intelligence/best-wallet', async (c) => {
  const body = await c.req.json<{ currency?: string; amount?: number }>();
  const wallet =
    mockStore.wallets.find((w) => w.currency === (body.currency ?? 'USD')) ?? mockStore.wallets[0];
  return c.json({
    mode: 'mock',
    wallet,
    reason: 'Highest available balance in requested currency',
  });
});

v1.post('/intelligence/best-currency', async (c) => {
  const body = await c.req.json<{ destinationCountry?: string }>();
  const currency = body.destinationCountry === 'GH' ? 'GHS' : 'USD';
  return c.json({ mode: 'mock', currency, reason: 'Matches destination corridor' });
});

v1.post('/intelligence/funding-source', async (c) => {
  const wallet = mockStore.wallets[0];
  return c.json({ mode: 'mock', wallet, rail: 'internal' });
});

v1.post('/intelligence/payment-route', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json({
    mode: 'mock',
    route: ['source_wallet', 'fx_if_needed', 'destination_rail'],
    estimatedFee: 2.5,
    ...body,
  });
});

v1.post('/intelligence/payment-schedule', async (c) => {
  const body = await c.req.json<{ dueDate?: string }>();
  return c.json({
    mode: 'mock',
    recommendedPayAt: body.dueDate ?? new Date(Date.now() + 86_400_000).toISOString(),
    reason: 'Pay one day before due to avoid late fees',
  });
});

// ─── Payment status / pending ──────────────────────────────────────────────

v1.get('/payments/status', (c) => {
  const id = c.req.query('id') ?? '';
  const approval = mockStore.approvals.find(
    (a) => a.id === id || a.preparationId === id || a.transactionId === id,
  );
  const tx = mockStore.transactions.find((t) => t.id === id || t.wewireId === id);
  if (approval) {
    return c.json({
      mode: 'mock',
      kind: 'preparation',
      id: approval.preparationId,
      approvalId: approval.id,
      status: approval.status,
      payload: approval.payload,
    });
  }
  if (tx) {
    return c.json({
      mode: 'mock',
      kind: 'transaction',
      id: tx.id,
      wewireId: tx.wewireId,
      status: tx.status,
    });
  }
  return c.json({ error: 'not_found' }, 404);
});

v1.get('/transfers/pending', (c) => {
  const pending = mockStore.transactions.filter(
    (t) => t.status === 'PENDING' || t.status === 'PROCESSING' || t.status === 'REQUIRES_APPROVAL',
  );
  const pendingApprovals = mockStore.approvals.filter((a) => a.status === 'pending');
  return c.json({ mode: 'mock', transfers: pending, preparations: pendingApprovals });
});

// ─── Financial plans ───────────────────────────────────────────────────────

v1.post('/plans', async (c) => {
  const body = await c.req.json<{
    intent: string;
    currency?: string;
    items?: Array<Record<string, unknown>>;
  }>();
  const items =
    body.items && body.items.length
      ? body.items
      : [
          { kind: 'payroll', label: 'Payroll due today', amount: 5700, currency: 'USD' },
          { kind: 'payment', label: 'Rent', amount: 250, currency: 'USD' },
          {
            kind: 'invoice',
            label: 'TechFlow INV-1042',
            amount: 780,
            currency: 'GBP',
            refId: 'inv-1',
          },
          {
            kind: 'supplier',
            label: 'ClearView Partners',
            amount: 1500,
            currency: 'GBP',
            refId: 'sup-2',
          },
        ];
  if (body.items?.length) {
    const itemCurrencyValues = items.map((item) => String(item.currency ?? ''));
    const itemCurrencies = new Set(itemCurrencyValues);
    if (itemCurrencyValues.some((currency) => !currency) || itemCurrencies.size !== 1) {
      return c.json({ error: 'plan_currency_mismatch' }, 400);
    }
    const itemCurrency = itemCurrencies.values().next().value;
    if (body.currency && body.currency !== itemCurrency) {
      return c.json({ error: 'plan_currency_mismatch' }, 400);
    }
  }
  const total = items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const plan = {
    id: newId('plan'),
    intent: body.intent,
    status: 'pending_approval' as const,
    items,
    total,
    currency: body.currency ?? String(items[0]?.currency ?? 'USD'),
    createdAt: new Date().toISOString(),
  };
  mockStore.plans.unshift(plan);
  const prep = createPreparation('payment', {
    planId: plan.id,
    intent: plan.intent,
    items: plan.items,
    total: plan.total,
    currency: plan.currency,
  });
  return c.json({ mode: 'mock', plan, ...prep }, 201);
});

v1.get('/plans', (c) => c.json({ mode: 'mock', plans: mockStore.plans }));

v1.get('/plans/:id', (c) => {
  const plan = mockStore.plans.find((p) => p.id === c.req.param('id'));
  if (!plan) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', plan });
});

v1.post('/plans/:id/cancel', (c) => {
  const plan = mockStore.plans.find((p) => p.id === c.req.param('id'));
  if (!plan) return c.json({ error: 'not_found' }, 404);
  plan.status = 'cancelled';
  return c.json({ mode: 'mock', plan });
});

// ─── Agent transactions (MCP unit of work) ─────────────────────────────────

v1.post('/agent-transactions', async (c) => {
  const body = await c.req.json<{ label?: string }>();
  const tx = {
    id: newId('atx'),
    label: body.label,
    status: 'open' as const,
    preparationIds: [] as string[],
    createdAt: new Date().toISOString(),
  };
  mockStore.agentTransactions.unshift(tx);
  return c.json({ mode: 'mock', transaction: tx }, 201);
});

v1.post('/agent-transactions/:id/commit', async (c) => {
  const body = await c.req.json<{ note?: string }>().catch(() => ({ note: undefined }));
  const tx = mockStore.agentTransactions.find((t) => t.id === c.req.param('id'));
  if (!tx) return c.json({ error: 'not_found' }, 404);
  if (tx.status !== 'open') return c.json({ error: 'not_open', status: tx.status }, 409);
  tx.status = 'committed';
  tx.closedAt = new Date().toISOString();
  const pending = mockStore.approvals.filter((a) => a.status === 'pending');
  return c.json({
    mode: 'mock',
    transaction: tx,
    approvalsQueued: pending.length,
    note: body.note,
    message: 'Committed. Human notified in Finora Approvals inbox.',
  });
});

v1.post('/agent-transactions/:id/rollback', async (c) => {
  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));
  const tx = mockStore.agentTransactions.find((t) => t.id === c.req.param('id'));
  if (!tx) return c.json({ error: 'not_found' }, 404);
  if (tx.status !== 'open') return c.json({ error: 'not_open', status: tx.status }, 409);
  tx.status = 'rolled_back';
  tx.closedAt = new Date().toISOString();
  for (const prepId of tx.preparationIds) {
    const item = mockStore.approvals.find((a) => a.preparationId === prepId);
    if (item && item.status === 'pending') {
      item.status = 'cancelled';
      item.resolvedAt = new Date().toISOString();
    }
  }
  return c.json({ mode: 'mock', transaction: tx, reason: body.reason });
});

// ─── Invoice source email ──────────────────────────────────────────────────

v1.get('/invoices/:id/source-email', (c) => {
  const inv = mockStore.invoices.find((i) => i.id === c.req.param('id'));
  if (!inv) return c.json({ error: 'not_found' }, 404);
  return c.json({
    mode: 'mock',
    invoiceId: inv.id,
    sourceEmail: inv.sourceEmail ?? null,
  });
});

// ─── Policy CRUD ───────────────────────────────────────────────────────────

v1.post('/policies', async (c) => {
  const body = await c.req.json<{ name: string; rule: string; enabled?: boolean }>();
  const policy = {
    id: newId('pol'),
    name: body.name,
    rule: body.rule,
    enabled: body.enabled ?? true,
  };
  mockStore.policies.push(policy);
  return c.json({ mode: 'mock', policy }, 201);
});

v1.patch('/policies/:id', async (c) => {
  const body = await c.req.json<{ name?: string; rule?: string; enabled?: boolean }>();
  const policy = mockStore.policies.find((p) => p.id === c.req.param('id'));
  if (!policy) return c.json({ error: 'not_found' }, 404);
  if (body.name !== undefined) policy.name = body.name;
  if (body.rule !== undefined) policy.rule = body.rule;
  if (body.enabled !== undefined) policy.enabled = body.enabled;
  return c.json({ mode: 'mock', policy });
});

v1.delete('/policies/:id', (c) => {
  const idx = mockStore.policies.findIndex((p) => p.id === c.req.param('id'));
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  const [policy] = mockStore.policies.splice(idx, 1);
  return c.json({ mode: 'mock', deleted: true, policy });
});

v1.post('/policies/assign', async (c) => {
  const body = await c.req.json<{
    policyId: string;
    targetType: string;
    targetId: string;
  }>();
  const policy = mockStore.policies.find((p) => p.id === body.policyId);
  if (!policy) return c.json({ error: 'policy_not_found' }, 404);
  return c.json({ mode: 'mock', assigned: true, policy, target: body });
});

v1.post('/policies/simulate', async (c) => {
  const body = await c.req.json<{ action: string; amount?: number }>();
  const amount = Number(body.amount ?? 0);
  return c.json({
    mode: 'mock',
    simulation: true,
    action: body.action,
    wouldRequireApproval: amount > 500,
    wouldAutoApprove: amount > 0 && amount <= 100,
    wouldBlock: false,
  });
});

// ─── Capabilities ──────────────────────────────────────────────────────────

v1.get('/capabilities/rails', (c) =>
  c.json({
    mode: 'mock',
    rails: ['bank', 'mobile_money', 'crypto', 'internal', 'fx'],
    settlementMethods: [
      'MOMO',
      'LOCAL_BANK',
      'ACH',
      'WIRE',
      'FPS',
      'CHAPS',
      'SEPA',
      'SWIFT',
      'CRYPTO',
    ],
  }),
);

v1.get('/capabilities/countries', (c) =>
  c.json({
    mode: 'mock',
    countries: SEND_CORRIDORS.map((country) => ({
      code: country.code,
      name: country.name,
      alpha3: country.alpha3,
      currency: country.currency,
      rails: country.rails,
    })),
  }),
);

v1.get('/capabilities/countries/:code/rails', (c) => {
  const code = c.req.param('code').toUpperCase();
  const country = SEND_CORRIDORS.find((x) => x.code === code);
  if (!country) return c.json({ error: 'Country not supported' }, 404);
  return c.json({
    mode: 'mock',
    code: country.code,
    rails: country.rails,
    fields: country.fields,
  });
});

v1.post('/rates/conversion/preview', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const quote = previewFxQuote({
    from: body.from as Currency,
    to: body.to as Currency,
    amount: body.amount,
  });
  return c.json({ mode: 'mock', ...quote });
});

v1.get('/capabilities/assets', (c) =>
  c.json({
    mode: 'mock',
    assets: [
      { code: 'USD', kind: 'fiat' },
      { code: 'GHS', kind: 'fiat' },
      { code: 'GBP', kind: 'fiat' },
      { code: 'EUR', kind: 'fiat' },
      { code: 'NGN', kind: 'fiat' },
      { code: 'KES', kind: 'fiat' },
      { code: 'CAD', kind: 'fiat' },
      { code: 'AED', kind: 'fiat' },
      { code: 'USDT', kind: 'crypto' },
      { code: 'USDC', kind: 'crypto' },
    ],
  }),
);

v1.get('/capabilities/blockchains', (c) =>
  c.json({
    mode: 'mock',
    blockchains: ['TRON', 'ETHEREUM', 'POLYGON', 'SOLANA'],
  }),
);

v1.get('/capabilities/networks', (c) =>
  c.json({
    mode: 'mock',
    networks: {
      mobile_money: ['MTN', 'Vodafone', 'AirtelTigo'],
      crypto: ['TRC20', 'ERC20', 'SOL'],
    },
  }),
);

// ─── Conversation context ──────────────────────────────────────────────────

v1.get('/context/recent', (c) => {
  const limit = Number(c.req.query('limit') ?? 5);
  return c.json({
    mode: 'mock',
    recipients: mockStore.contacts.slice(0, limit),
    wallets: mockStore.wallets.slice(0, limit),
    transactions: mockStore.transactions.slice(0, limit),
    lastRecipient: mockStore.contacts[0] ?? null,
    lastWallet: mockStore.wallets[0] ?? null,
  });
});

v1.get('/context/last-recipient', (c) =>
  c.json({ mode: 'mock', recipient: mockStore.contacts[0] ?? null }),
);

v1.get('/context/last-wallet', (c) =>
  c.json({ mode: 'mock', wallet: mockStore.wallets[0] ?? null }),
);

// ─── Events / webhooks ─────────────────────────────────────────────────────

v1.get('/events/types', (c) =>
  c.json({
    mode: 'mock',
    eventTypes: [
      'payment.prepared',
      'payment.approved',
      'payment.executed',
      'payment.failed',
      'approval.requested',
      'invoice.detected',
      'kyc.updated',
    ],
  }),
);

v1.post('/events/subscribe', async (c) => {
  const body = await c.req.json<{ eventTypes: string[] }>();
  const sub = {
    id: newId('sub'),
    eventTypes: body.eventTypes,
    createdAt: new Date().toISOString(),
  };
  mockStore.eventSubscriptions.push(sub);
  return c.json({ mode: 'mock', subscription: sub }, 201);
});

v1.post('/events/unsubscribe', async (c) => {
  const body = await c.req.json<{ subscriptionId: string }>();
  const idx = mockStore.eventSubscriptions.findIndex((s) => s.id === body.subscriptionId);
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  mockStore.eventSubscriptions.splice(idx, 1);
  return c.json({ mode: 'mock', unsubscribed: true });
});

v1.get('/webhooks', (c) => c.json({ mode: 'mock', webhooks: mockStore.webhooks }));

v1.post('/webhooks', async (c) => {
  const body = await c.req.json<{ url: string; eventTypes: string[] }>();
  const hook = {
    id: newId('wh'),
    url: body.url,
    eventTypes: body.eventTypes,
    createdAt: new Date().toISOString(),
  };
  mockStore.webhooks.push(hook);
  return c.json({ mode: 'mock', webhook: hook }, 201);
});

v1.delete('/webhooks/:id', (c) => {
  const idx = mockStore.webhooks.findIndex((w) => w.id === c.req.param('id'));
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  mockStore.webhooks.splice(idx, 1);
  return c.json({ mode: 'mock', deleted: true });
});
