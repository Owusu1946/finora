import { useUser } from '@clerk/expo';
import { useCallback, useMemo } from 'react';

import { clerkErrorMessage } from '@/lib/clerk-auth';

export function useEmailVerification() {
  const { user } = useUser();

  const sendCode = useCallback(async () => {
    const emailAddress = user?.primaryEmailAddress ?? user?.emailAddresses[0];
    if (!emailAddress)
      return { ok: false as const, error: 'No verified email is on this account.' };

    try {
      await emailAddress.prepareVerification({ strategy: 'email_code' });
      return { ok: true as const, email: emailAddress.emailAddress };
    } catch (error) {
      return {
        ok: false as const,
        error: clerkErrorMessage(error, 'Could not send the verification code.'),
      };
    }
  }, [user]);

  const verifyCode = useCallback(
    async (code: string) => {
      const emailAddress = user?.primaryEmailAddress ?? user?.emailAddresses[0];
      if (!emailAddress) return { ok: false as const, error: 'No email is on this account.' };

      try {
        const result = await emailAddress.attemptVerification({ code });
        if (result.verification.status !== 'verified') {
          return { ok: false as const, error: 'That verification code is invalid or expired.' };
        }
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: clerkErrorMessage(error, 'That verification code is invalid or expired.'),
        };
      }
    },
    [user],
  );

  return useMemo(() => ({ sendCode, verifyCode }), [sendCode, verifyCode]);
}
