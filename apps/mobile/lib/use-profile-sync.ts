import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

import { setAccountType } from '@/lib/account';
import { getApiUrl } from '@/lib/api-url';
import { getTagConfigured, setTagConfigured } from '@/lib/auth-storage';
import { completeOnboarding, getOnboardingState } from '@/lib/onboarding-storage';
import { usePhoneGate } from '@/lib/phone-gate';
import { getUserProfile, updateUserProfile } from '@/lib/profile-api';
import { getSettings, saveSettings } from '@/lib/settings-storage';

const PROFILE_SYNC_RETRY_DELAYS_MS = [0, 1_000, 3_000] as const;

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function useProfileSync() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { markLoading, setFromProfile } = usePhoneGate();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    if (!getApiUrl()) {
      setFromProfile(null);
      if (__DEV__) console.warn('Profile sync skipped because the Finora API URL is unavailable.');
      return;
    }

    markLoading();

    let cancelled = false;
    void (async () => {
      let lastError: unknown;

      for (const retryDelay of PROFILE_SYNC_RETRY_DELAYS_MS) {
        if (retryDelay > 0) await wait(retryDelay);
        if (cancelled) return;

        try {
          const getCurrentToken = () => getTokenRef.current();
          const [local, remote, tagConfigured] = await Promise.all([
            getOnboardingState(),
            getUserProfile(getCurrentToken),
            getTagConfigured(userId),
          ]);
          if (cancelled) return;

          const settings = tagConfigured ? await getSettings() : null;
          const updates = {
            ...(remote.accountType === null && local.accountType
              ? { accountType: local.accountType }
              : {}),
            ...(remote.finoraTag === null && settings?.finoraTag
              ? { finoraTag: settings.finoraTag }
              : {}),
          };
          const profile =
            Object.keys(updates).length > 0
              ? await updateUserProfile(getCurrentToken, updates)
              : remote;
          if (cancelled) return;

          await Promise.all([
            profile.accountType && (!local.completed || local.accountType !== profile.accountType)
              ? completeOnboarding(profile.accountType)
              : Promise.resolve(),
            saveSettings({
              displayName: profile.displayName,
              email: profile.email,
              ...(profile.finoraTag ? { finoraTag: profile.finoraTag } : {}),
            }),
            profile.finoraTag && !tagConfigured ? setTagConfigured(userId) : Promise.resolve(),
          ]);
          if (cancelled) return;

          if (profile.accountType) setAccountType(profile.accountType);
          setFromProfile(profile.phoneVerifiedAt);
          return;
        } catch (error) {
          lastError = error;
        }
      }

      // Never leave the navigation gate suspended after the retry budget is exhausted.
      if (!cancelled) setFromProfile(null);
      if (__DEV__) console.warn('Profile sync failed after retries.', lastError);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, markLoading, setFromProfile, userId]);
}
