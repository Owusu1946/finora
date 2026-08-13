import { useAuth } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured } from '@/lib/auth-storage';
import { usePhoneGate } from '@/lib/phone-gate';
import { getUserProfile } from '@/lib/profile-api';

/** After Clerk auth success, route to tag selection once or enter the app. */
export function usePostAuthNavigate() {
  const router = useRouter();
  const { getToken, userId: activeUserId } = useAuth();
  const { markLoading, setFromProfile } = usePhoneGate();
  const { markTagConfigured } = useAuthGate();

  return useCallback(
    async (authenticatedUserId?: string | null) => {
      const tagConfigured = await getTagConfigured(authenticatedUserId ?? activeUserId);
      markLoading();
      try {
        const profile = await getUserProfile(getToken);
        setFromProfile(profile.phoneVerifiedAt);
        if (!profile.phoneVerifiedAt) {
          router.replace('/auth/add-phone' as Href);
          return;
        }
      } catch {
        router.replace('/auth/add-phone' as Href);
        return;
      }
      if (tagConfigured) {
        markTagConfigured();
        router.replace('/(app)' as Href);
        return;
      }
      router.replace('/auth/choose-tag' as Href);
    },
    [activeUserId, getToken, markLoading, markTagConfigured, router, setFromProfile],
  );
}
