import { useClerk } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { useCallback, useState } from 'react';

import { clearPendingAuthProfile } from '@/lib/auth-profile';
import { clerkErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

export function useGoogleAuth() {
  const clerk = useClerk();
  const { startSSOFlow } = useSSO();
  const postAuthNavigate = usePostAuthNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogleAuth = useCallback(async () => {
    if (loading) return;

    setError(null);
    setLoading(true);
    clearPendingAuthProfile();
    try {
      const result = await startSSOFlow({ strategy: 'oauth_google' });
      if (!result.createdSessionId) return;

      haptics.success();
      const authenticatedUserId =
        result.signUp?.createdUserId ??
        clerk?.client?.sessions?.find((session) => session.id === result.createdSessionId)?.user
          ?.id ??
        clerk?.session?.user?.id;
      await postAuthNavigate(authenticatedUserId);
    } catch (caught) {
      haptics.impact();
      setError(clerkErrorMessage(caught, 'Google sign-in could not be completed.'));
    } finally {
      setLoading(false);
    }
  }, [clerk, loading, postAuthNavigate, startSSOFlow]);

  return { startGoogleAuth, loading, error, clearError: () => setError(null) };
}
