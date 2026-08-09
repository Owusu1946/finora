import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured } from '@/lib/auth-storage';

/** After mock auth success → choose-tag (first time) or app. */
export function usePostAuthNavigate() {
  const router = useRouter();
  const { markAuthenticated, markTagConfigured } = useAuthGate();

  return useCallback(async () => {
    markAuthenticated();
    const tagConfigured = await getTagConfigured();
    if (tagConfigured) {
      markTagConfigured();
      router.replace('/(app)' as Href);
      return;
    }
    router.replace('/auth/choose-tag' as Href);
  }, [markAuthenticated, markTagConfigured, router]);
}
