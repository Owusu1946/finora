import { useSignIn, useUser } from '@clerk/expo';
import { useCallback, useMemo } from 'react';

import { clerkErrorMessage } from '@/lib/clerk-auth';

export function useEmailVerification() {
  const { user } = useUser();
  const { signIn } = useSignIn();

  const sendCode = useCallback(async () => {
    const emailAddress = user?.primaryEmailAddress ?? user?.emailAddresses[0];
    if (!emailAddress)
      return { ok: false as const, error: 'No verified email is on this account.' };

    const result = await signIn.emailCode.sendCode({ emailAddress: emailAddress.emailAddress });
    if (result.error) {
      return {
        ok: false as const,
        error: clerkErrorMessage(result.error, 'Could not send the verification code.'),
      };
    }
    return { ok: true as const, email: emailAddress.emailAddress };
  }, [signIn, user]);

  const verifyCode = useCallback(
    async (code: string) => {
      const emailAddress = user?.primaryEmailAddress ?? user?.emailAddresses[0];
      if (!emailAddress) return { ok: false as const, error: 'No email is on this account.' };

      const result = await signIn.emailCode.verifyCode({ code });
      if (result.error) {
        return {
          ok: false as const,
          error: clerkErrorMessage(result.error, 'That verification code is invalid or expired.'),
        };
      }
      if (signIn.status !== 'complete') {
        return { ok: false as const, error: 'That verification code is invalid or expired.' };
      }
      await signIn.reset();
      return { ok: true as const };
    },
    [signIn, user],
  );

  return useMemo(() => ({ sendCode, verifyCode }), [sendCode, verifyCode]);
}
