import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { setAccountType } from '@/lib/account';
import { getTagConfigured } from '@/lib/auth-storage';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { getUserProfile, updateUserProfile } from '@/lib/profile-api';
import { getSettings } from '@/lib/settings-storage';

export function useProfileSync() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !process.env.EXPO_PUBLIC_API_URL) return;

    let cancelled = false;
    void (async () => {
      try {
        const [local, remote, tagConfigured] = await Promise.all([
          getOnboardingState(),
          getUserProfile(getToken),
          getTagConfigured(userId),
        ]);
        if (cancelled) return;

        const settings = tagConfigured ? await getSettings() : null;
        const updates = {
          ...(local.accountType && remote.accountType !== local.accountType
            ? { accountType: local.accountType }
            : {}),
          ...(settings?.finoraTag && remote.finoraTag !== settings.finoraTag
            ? { finoraTag: settings.finoraTag }
            : {}),
        };

        if (Object.keys(updates).length > 0) {
          await updateUserProfile(getToken, updates);
          if (!cancelled && local.accountType) setAccountType(local.accountType);
          return;
        }

        if (remote.accountType) setAccountType(remote.accountType);
      } catch (error) {
        // Local onboarding state remains available when profile sync is temporarily unavailable.
        if (__DEV__) console.warn('Profile sync failed.', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, userId]);
}
