import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getUserProfile } from '@/lib/profile-api';

const MIN_RELOAD_INTERVAL_MS = 5 * 60_000;

/**
 * Re-fetch the Clerk user periodically so OAuth profile changes (name, avatar)
 * surface without a full re-auth. At most one reload in flight and no more than
 * one every five minutes, on mount and when the app returns to the foreground.
 *
 * Each reload first pings /v1/auth/me: the worker pulls the newest avatar from
 * the OAuth provider when Clerk's snapshot is behind, then we re-read Clerk so
 * the fresh imageUrl lands.
 */
export function useClerkUserRefresh() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const userRef = useRef(user);
  userRef.current = user;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const reloadPendingRef = useRef(false);
  const lastReloadedAtRef = useRef(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    const reload = () => {
      if (reloadPendingRef.current) return;
      if (Date.now() - lastReloadedAtRef.current < MIN_RELOAD_INTERVAL_MS) return;
      reloadPendingRef.current = true;
      void (async () => {
        try {
          await getUserProfile(getTokenRef.current).catch(() => undefined);
          await userRef.current?.reload();
        } catch {
          // Network or Clerk failures surface on the next foreground anyway.
        } finally {
          reloadPendingRef.current = false;
          lastReloadedAtRef.current = Date.now();
        }
      })();
    };
    reload();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [isLoaded, isSignedIn, userId]);
}
