import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { listActions } from './actions-api';
import { ensureNotificationPermission } from './automation-notifications';
import { useSettings } from './settings-context';

const POLL_INTERVAL_MS = 20_000;
const CURSOR_PREFIX = 'finora.approval-notification-cursor.';

/**
 * Tells the user when an AI agent (over MCP) prepares a payment for them to
 * approve, while the app is open. Tapping it opens the approval.
 */
export function ApprovalNotificationBridge() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { settings, loading } = useSettings();
  const pollingRef = useRef(false);
  const enabled =
    isLoaded && isSignedIn && Boolean(userId) && !loading && settings.notifications.approvals;

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const cursorKey = `${CURSOR_PREFIX}${userId}`;

    const poll = async () => {
      if (cancelled || AppState.currentState !== 'active' || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const cursor = await AsyncStorage.getItem(cursorKey);
        // First run only remembers where we are, so old items don't all notify at once.
        if (!cursor) {
          await AsyncStorage.setItem(cursorKey, new Date().toISOString());
          return;
        }
        const fromAgents = (await listActions({ status: 'pending_approval' }))
          .filter((action) => action.source === 'mcp')
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const newest = fromAgents.at(-1)?.createdAt;
        if (await ensureNotificationPermission()) {
          for (const action of fromAgents.filter((item) => item.createdAt > cursor)) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'An AI agent prepared a payment',
                body: `${action.title}: ${action.currency} ${action.amount.toLocaleString()}. Approve or reject it in Finora.`,
                data: { url: `/approval/${action.id}` },
              },
              trigger: Platform.OS === 'android' ? { channelId: 'automations' } : null,
            });
          }
        }
        if (newest && newest > cursor) await AsyncStorage.setItem(cursorKey, newest);
      } catch (error) {
        if (__DEV__) console.warn('[approvals] notification check failed', error);
      } finally {
        pollingRef.current = false;
      }
    };

    const start = () => {
      if (interval) clearInterval(interval);
      void poll();
      interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else if (interval) clearInterval(interval);
    });
    if (AppState.currentState === 'active') start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, userId]);

  return null;
}
