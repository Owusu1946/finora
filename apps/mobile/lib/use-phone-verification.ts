import { useAuth } from '@clerk/expo';
import { useCallback, useMemo } from 'react';

import { getApiUrl } from '@/lib/api-url';

const REQUEST_TIMEOUT_MS = 15_000;

export type PhoneVerificationErrorCode =
  | 'invalid_phone_number'
  | 'phone_number_in_use'
  | 'sms_rate_limited'
  | 'verification_code_expired'
  | 'invalid_code'
  | 'request_failed';

export class PhoneVerificationError extends Error {
  constructor(
    readonly code: PhoneVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PhoneVerificationError';
  }
}

function errorMessage(code: string | undefined) {
  if (code === 'invalid_phone_number') return 'Enter a valid Ghana phone number.';
  if (code === 'phone_number_in_use') return 'This phone number is already linked to another account.';
  if (code === 'sms_rate_limited') return 'A code was just sent. Wait a moment before resending.';
  if (code === 'verification_code_expired') return 'That code has expired. Request a new one.';
  if (code === 'invalid_code') return 'That verification code is incorrect.';
  return 'Could not complete phone verification. Try again.';
}

async function phoneFetch(
  path: string,
  body: Record<string, unknown>,
  getToken: () => Promise<string | null>,
) {
  const apiUrl = getApiUrl();
  if (!apiUrl)
    throw new PhoneVerificationError('request_failed', 'The Finora API is not configured.');
  const token = await getToken();
  if (!token)
    throw new PhoneVerificationError('request_failed', 'Your session is not ready. Try again.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      verified?: boolean;
      phoneHint?: string;
      error?: string;
    } | null;
    if (!response.ok) {
      const code = (payload?.error ?? 'request_failed') as PhoneVerificationErrorCode;
      throw new PhoneVerificationError(code, errorMessage(code));
    }
    return payload;
  } catch (error) {
    if (error instanceof PhoneVerificationError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PhoneVerificationError('request_failed', 'The SMS service timed out. Try again.');
    }
    throw new PhoneVerificationError(
      'request_failed',
      'Could not reach Finora. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function usePhoneVerification() {
  const { getToken } = useAuth();

  const request = useCallback(
    async (phoneNumber: string, options?: { force?: boolean }) => {
      return phoneFetch(
        '/v1/auth/phone-verification/request',
        { phoneNumber, ...(options?.force ? { force: true } : {}) },
        getToken,
      );
    },
    [getToken],
  );

  const verify = useCallback(
    async (code: string) => {
      await phoneFetch('/v1/auth/phone-verification/verify', { code }, getToken);
    },
    [getToken],
  );

  return useMemo(() => ({ request, verify }), [request, verify]);
}
