import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { setAccountType } from '@/lib/account';
import { getApiUrl } from '@/lib/api-url';
import { getTagConfigured, setTagConfigured } from '@/lib/auth-storage';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { usePhoneGate } from '@/lib/phone-gate';
import { getUserProfile, updateUserProfile } from '@/lib/profile-api';
import { getSettings } from '@/lib/settings-storage';

export function useProfileSync() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { markLoading, setFromProfile } = usePhoneGate();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !getApiUrl()) return;
    markLoading();

    let cancelled = false;
    void (async () => {
      try {
        const [local, remote, tagConfigured] = await Promise.all([
          getOnboardingState(),
          getUserProfile(getToken),
          getTagConfigured(userId),
        ]);
        if (cancelled) return;
        setFromProfile(remote.phoneVerifiedAt);
        if (remote.finoraTag && !tagConfigured) {
          await setTagConfigured(userId);
        }

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
  }, [getToken, isLoaded, isSignedIn, markLoading, setFromProfile, userId]);
}
