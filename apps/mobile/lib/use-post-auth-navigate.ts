import { useAuth } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured, setTagConfigured } from '@/lib/auth-storage';
import { hasPasscode } from '@/lib/passcode-storage';
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
      const targetUserId = authenticatedUserId ?? activeUserId;
      const tagConfigured = await getTagConfigured(targetUserId);
      const passcodeExists = await hasPasscode();
      markLoading();

      try {
        const profile = await getUserProfile(getToken);
        setFromProfile(profile.phoneVerifiedAt);

        // Returning user check: if local tag is configured OR remote profile has finoraTag
        const isReturningUser = tagConfigured || Boolean(profile.finoraTag);
        if (isReturningUser) {
          if (targetUserId && profile.finoraTag) {
            await setTagConfigured(targetUserId);
          }
          if (passcodeExists) {
            router.replace('/auth/enter-passcode' as Href);
            return;
          }
          router.replace('/auth/create-passcode' as Href);
          return;
        }

        if (!profile.phoneVerifiedAt) {
          router.replace('/auth/add-phone' as Href);
          return;
        }
      } catch {
        if (tagConfigured) {
          if (passcodeExists) {
            router.replace('/auth/enter-passcode' as Href);
            return;
          }
          router.replace('/auth/create-passcode' as Href);
          return;
        }
        router.replace('/auth/add-phone' as Href);
        return;
      }

      router.replace('/auth/choose-tag' as Href);
    },
    [activeUserId, getToken, markLoading, markTagConfigured, router, setFromProfile],
  );
}
