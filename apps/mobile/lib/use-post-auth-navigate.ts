import { useAuth } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured } from '@/lib/auth-storage';

/** After Clerk auth success, route to tag selection once or enter the app. */
export function usePostAuthNavigate() {
  const router = useRouter();
  const { userId: activeUserId } = useAuth();
  const { markTagConfigured } = useAuthGate();

  return useCallback(async (authenticatedUserId?: string | null) => {
    const tagConfigured = await getTagConfigured(authenticatedUserId ?? activeUserId);
    if (tagConfigured) {
      markTagConfigured();
      router.replace('/(app)' as Href);
      return;
    }
    router.replace('/auth/choose-tag' as Href);
  }, [activeUserId, markTagConfigured, router]);
}
