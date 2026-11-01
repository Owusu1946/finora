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
import { mockStore, newId } from '../mock/store';
import { syncOAuthAvatar } from '../oauth-avatar';
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
  const user = await syncOAuthAvatar(clerk, await clerk.users.getUser(userId));
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
  const user = await syncOAuthAvatar(clerk, await clerk.users.getUser(userId));
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

// ─── Receive ───────────────────────────────────────────────────────────────────────────────────────────────────────

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

v1.get('/currencies', (c) =>
  c.json({
    mode: 'mock',
    currencies: ['USD', 'GHS', 'EUR', 'GBP', 'USDT', 'USDC'],
  }),
);

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
  // A request for someone to pay the user: nothing to approve, no money moves.
  const requestId = newId('req');
  const link = `https://pay.finora.app/r/${requestId}`;
  return c.json(
    {
      mode: 'mock',
      status: 'created',
      requestId,
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

// ─── Transaction search / filter ───────────────────────────────────────────

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

// ─── Notifications / integrations ──────────────────────────────────────────

v1.get('/integrations', (c) => c.json({ mode: 'mock', integrations: mockStore.integrations }));

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
