import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuthGate } from '@/lib/auth-gate';

/** After mock auth success → app (onboarding already completed). */
export function usePostAuthNavigate() {
  const router = useRouter();
  const { markAuthenticated } = useAuthGate();

  return useCallback(() => {
    markAuthenticated();
    router.replace('/(app)' as Href);
  }, [markAuthenticated, router]);
}
