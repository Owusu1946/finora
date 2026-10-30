import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { listAutomationActivity, type AutomationActivity } from './automations-api';
import { requestOpenThread } from './open-thread';
import { useSettings } from './settings-context';

const CHANNEL_ID = 'automations';
const POLL_INTERVAL_MS = 20_000;
const CURSOR_PREFIX = 'finora.automation-notification-cursor.';
const NOTIFIABLE_STATUSES = new Set<AutomationActivity['status']>([
  'prepared_approval',
  'notified',
  'failed',
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function notificationTitle(activity: AutomationActivity) {
  if (activity.status === 'prepared_approval') return `${activity.automationName} is ready`;
  if (activity.status === 'failed') return 'Automation needs attention';
  return activity.automationName;
}

function isNotificationPermissionGranted(status: Notifications.NotificationPermissionsStatus) {
  if (status.granted) return true;
  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Automations',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (isNotificationPermissionGranted(current)) return true;
  if (!current.canAskAgain) return false;
  return isNotificationPermissionGranted(await Notifications.requestPermissionsAsync());
}

async function presentActivity(activity: AutomationActivity) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notificationTitle(activity),
      body: activity.summary,
      data: {
        // Runs post to the Automations chat; failures are explained on the Automations screen.
        url: '/automations',
        chatId: activity.chatId,
        automationId: activity.automationId,
      },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  });
}

export function AutomationNotificationBridge() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const router = useRouter();
  const pollingRef = useRef(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const stableGetToken = useCallback(() => getTokenRef.current(), []);
  const enabled =
    isLoaded &&
    isSignedIn &&
    Boolean(userId) &&
    !settingsLoading &&
    (settings.notifications.approvals || settings.notifications.payments);

  const openNotification = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (typeof data?.chatId === 'string') requestOpenThread(data.chatId);
      else if (typeof data?.url === 'string') router.push(data.url as Href);
      else return;
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    },
    [router],
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openNotification(response);
    });
    void Notifications.getLastNotificationResponseAsync().then(openNotification);
    return () => subscription.remove();
  }, [openNotification]);

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
        const activity = await listAutomationActivity(stableGetToken, cursor ?? undefined);
        if (cancelled || activity.length === 0) return;

        const ordered = [...activity].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const newestCursor = ordered.at(-1)?.createdAt;
        if (!cursor) {
          if (newestCursor) await AsyncStorage.setItem(cursorKey, newestCursor);
          return;
        }

        if (await ensureNotificationPermission()) {
          for (const item of ordered) {
            if (NOTIFIABLE_STATUSES.has(item.status)) await presentActivity(item);
          }
        }
        if (newestCursor) await AsyncStorage.setItem(cursorKey, newestCursor);
      } catch (error) {
        console.warn('Unable to check automation notifications.', error);
      } finally {
        pollingRef.current = false;
      }
    };

    const startPolling = () => {
      if (interval) clearInterval(interval);
      void poll();
      interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startPolling();
      else if (interval) clearInterval(interval);
    });
    if (AppState.currentState === 'active') startPolling();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [enabled, stableGetToken, userId]);

  return null;
}
