import { useAuth } from '@clerk/expo';
import { useCallback, useMemo } from 'react';

import { getApiUrl } from '@/lib/api-url';

const RECOVERY_REQUEST_TIMEOUT_MS = 15_000;

export class PasscodeRecoveryError extends Error {
  constructor(
    public readonly code: 'verified_phone_required' | 'sms_rate_limited' | 'request_failed',
    message: string,
  ) {
    super(message);
    this.name = 'PasscodeRecoveryError';
  }
}

async function recoveryFetch(
  path: string,
  init: RequestInit,
  getToken: () => Promise<string | null>,
) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('The Finora API URL is not configured.');
  const token = await getToken();
  if (!token) throw new Error('Your session is not ready. Try again.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECOVERY_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The SMS service timed out. Try again in a moment.');
    }
    throw new Error('Could not reach the Finora API. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}

export function usePasscodeRecovery() {
  const { getToken } = useAuth();

  const request = useCallback(async () => {
    const response = await recoveryFetch(
      '/v1/auth/passcode-recovery/request',
      {
        method: 'POST',
      },
      getToken,
    );
    const payload = (await response.json().catch(() => null)) as {
      challengeId?: string;
      phoneHint?: string;
      error?: string;
    } | null;
    if (!response.ok || !payload?.challengeId) {
      if (payload?.error === 'verified_phone_required') {
        throw new PasscodeRecoveryError(
          'verified_phone_required',
          'Add a verified phone number before resetting your passcode.',
        );
      }
      if (payload?.error === 'sms_rate_limited') {
        throw new PasscodeRecoveryError(
          'sms_rate_limited',
          'A code was just sent. Wait a few seconds before requesting another.',
        );
      }
      throw new PasscodeRecoveryError('request_failed', 'Could not send the passcode reset SMS.');
    }
    return { phoneHint: `••••${payload.phoneHint ?? ''}` };
  }, [getToken]);

  const verify = useCallback(
    async (code: string) => {
      const response = await recoveryFetch(
        '/v1/auth/passcode-recovery/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        },
        getToken,
      );
      const payload = (await response.json().catch(() => null)) as {
        verified?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.verified) {
        throw new Error(
          payload?.error === 'recovery_code_expired'
            ? 'That code has expired. Request a new one.'
            : 'That code is incorrect.',
        );
      }
    },
    [getToken],
  );

  return useMemo(() => ({ request, verify }), [request, verify]);
}
