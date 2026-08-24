import type {
  CalendarIntegrationStatus,
  DriveIntegrationStatus,
  GmailIntegrationStatus,
} from '@finora/shared';

import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { GmailLogo } from '@/components/integrations/gmail-logo';
import { GoogleCalendarLogo } from '@/components/integrations/google-calendar-logo';
import { GoogleDriveLogo } from '@/components/integrations/google-drive-logo';
import { IMessageLogo } from '@/components/integrations/imessage-logo';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import {
  beginCalendarConnection,
  disconnectCalendarIntegration,
  getCalendarEvents,
  getCalendarIntegrationStatus,
  syncCalendarIntegration,
} from '@/lib/calendar-integration-api';
import {
  beginDriveConnection,
  disconnectDriveIntegration,
  getDriveIntegrationStatus,
} from '@/lib/drive-integration-api';
import {
  beginGmailConnection,
  disconnectGmailIntegration,
  getGmailIntegrationStatus,
  syncGmailIntegration,
} from '@/lib/gmail-integration-api';
import { haptics } from '@/lib/haptics';
import {
  connectSmsInbox,
  disconnectSmsInbox,
  getIntegrations,
  type IntegrationsState,
} from '@/lib/integrations-storage';
import { listOpenSmsPaymentRequests } from '@/lib/sms-requests-storage';

type IntegrationCardProps = {
  title: string;
  detail: string;
  connected: boolean;
  icon: ReactNode;
  busy: boolean;
  connectedBody?: ReactNode;
  connectLabel: string;
  onConnect: () => void;
  onDisconnect: () => void;
};

function IntegrationCard({
  title,
  detail,
  connected,
  icon,
  busy,
  connectedBody,
  connectLabel,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  return (
    <View className='gap-3.5 rounded-[26px] border border-border bg-composer p-4'>
      <View className='flex-row items-center gap-3'>
        <View className='size-10 items-center justify-center rounded-xl border border-border bg-background'>
          {icon}
        </View>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[17px] text-foreground'>{title}</Text>
          <Text className='font-sans-medium text-sm text-muted-foreground'>{detail}</Text>
        </View>
        <View
          className={connected ? 'size-2 rounded bg-emerald-500' : 'size-2 rounded bg-border'}
        />
      </View>

      {connected ? (
        <View className='gap-3'>
          {connectedBody}
          <Pressable
            disabled={busy}
            onPress={onDisconnect}
            className='min-h-[46px] items-center justify-center rounded-[32px] border border-border px-3'
            style={({ pressed }) => ({ opacity: pressed || busy ? 0.7 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-foreground'>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          disabled={busy}
          onPress={onConnect}
          className='mt-1 min-h-[46px] items-center justify-center rounded-[32px] bg-foreground px-3'
          style={({ pressed }) => ({ opacity: pressed || busy ? 0.85 : 1 })}
        >
          <Text className='font-sans-semibold text-[15px] text-background'>
            {busy ? 'Connecting…' : connectLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function IntegrationsScreen() {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [state, setState] = useState<IntegrationsState | null>(null);
  const [busyKey, setBusyKey] = useState<'gmail' | 'calendar' | 'drive' | 'sms' | null>(null);
  const [gmail, setGmail] = useState<GmailIntegrationStatus | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarIntegrationStatus | null>(null);
  const [driveStatus, setDriveStatus] = useState<DriveIntegrationStatus | null>(null);
  const gmailRef = useRef<GmailIntegrationStatus | null>(null);
  const refreshInFlightRef = useRef(false);
  const getTokenRef = useRef(getToken);
  const [gmailStatusError, setGmailStatusError] = useState(false);
  const [calendarCount, setCalendarCount] = useState(0);
  const [smsCount, setSmsCount] = useState(0);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      console.info('[GmailIntegration] status refresh skipped', { reason: 'already_in_flight' });
      return;
    }
    refreshInFlightRef.current = true;
    try {
      console.info('[Calendar] integrations refresh starting');
      const [integrations, calendar, sms] = await Promise.all([
        getIntegrations(),
        getCalendarEvents(getTokenRef.current).catch((error) => {
          console.error('[Calendar] events fetch failed', {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error),
          });
          return [];
        }),
        listOpenSmsPaymentRequests(),
      ]);
      console.info('[Calendar] integrations events fetched', {
        count: calendar.length,
        events: calendar.map((event) => ({
          id: event.id,
          title: event.title,
          kind: event.kind,
          dueAt: event.dueAt,
        })),
      });
      setState(integrations);
      setCalendarCount(calendar.length);
      setSmsCount(sms.length);

      const [gmailResult, calendarResult] = await Promise.all([
        getGmailIntegrationStatus(getTokenRef.current)
          .then((value) => ({ value, failed: false as const }))
          .catch((error) => {
            console.error('[GmailIntegration] status refresh failed', {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: error instanceof Error ? error.message : String(error),
            });
            return { value: null, failed: true as const };
          }),
        getCalendarIntegrationStatus(getTokenRef.current).catch((error) => {
          console.error('[CalendarIntegration] status refresh failed', error);
          return null;
        }),
      ]);
      const driveResult = await getDriveIntegrationStatus(getTokenRef.current).catch((error) => {
        console.error('[DriveIntegration] status refresh failed', error);
        return null;
      });
      const gmailStatus = gmailResult.value ?? gmailRef.current;
      if (calendarResult) setCalendarStatus(calendarResult);
      if (driveResult) setDriveStatus(driveResult);
      console.info('[Calendar] status fetched', calendarResult);
      setState((current) => ({
        ...(current ?? integrations),
        gmailConnected: gmailStatus?.connected ?? false,
        gmailEmail: gmailStatus?.email ?? undefined,
        gmailConnectedAt: gmailStatus?.lastSyncedAt ?? undefined,
        calendarConnected: calendarResult?.connected ?? integrations.calendarConnected,
        calendarEmail: calendarResult?.email ?? integrations.calendarEmail,
        calendarConnectedAt: calendarResult?.lastSyncedAt ?? integrations.calendarConnectedAt,
      }));
      if (gmailResult.value) {
        gmailRef.current = gmailResult.value;
        setGmail(gmailResult.value);
      }
      setGmailStatusError(gmailResult.failed);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const runConnectDrive = async () => {
    setBusyKey('drive');
    try {
      const returnUrl = Linking.createURL('/integrations');
      const { authorizationUrl } = await beginDriveConnection(getToken, returnUrl);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
      if (
        result.type === 'success' &&
        new URL(result.url).searchParams.get('drive') !== 'connected'
      )
        throw new Error('Google Drive connection failed.');
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not connect Google Drive',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const runDisconnectDrive = async () => {
    setBusyKey('drive');
    try {
      await disconnectDriveIntegration(getToken);
      setDriveStatus(null);
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not disconnect Google Drive',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!state) {
    return (
      <View className='flex-1 bg-background'>
        <LoadingIcon
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  const runConnectCalendar = async () => {
    haptics.impact();
    setBusyKey('calendar');
    try {
      const returnUrl = Linking.createURL('/integrations');
      const { authorizationUrl } = await beginCalendarConnection(getToken, returnUrl);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
      if (result.type !== 'success') return;
      const outcome = new URL(result.url).searchParams.get('calendar');
      if (outcome === 'failed') throw new Error('Google Calendar connection failed.');
      if (outcome === 'connected') await refresh();
      haptics.success();
    } catch (error) {
      console.error('[CalendarIntegration] OAuth flow failed', error);
      Alert.alert(
        'Could not connect Calendar',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const runDisconnectCalendar = async () => {
    haptics.selection();
    setBusyKey('calendar');
    try {
      await disconnectCalendarIntegration(getToken);
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not disconnect Calendar',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const runConnectGmail = async () => {
    haptics.impact();
    setBusyKey('gmail');
    try {
      const returnUrl = Linking.createURL('/integrations');
      const returnUrlDetails = new URL(returnUrl);
      console.info('[GmailIntegration] OAuth starting', {
        returnProtocol: returnUrlDetails.protocol,
        returnPath: returnUrlDetails.pathname,
      });
      const { authorizationUrl } = await beginGmailConnection(getToken, returnUrl);
      const authorizationUrlDetails = new URL(authorizationUrl);
      console.info('[GmailIntegration] authorization URL received', {
        origin: authorizationUrlDetails.origin,
        path: authorizationUrlDetails.pathname,
      });
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
      console.info('[GmailIntegration] OAuth browser completed', { type: result.type });
      if (result.type !== 'success') {
        console.warn('[GmailIntegration] OAuth browser did not return success', {
          type: result.type,
        });
        return;
      }
      const oauthResult = new URL(result.url).searchParams.get('gmail');
      console.info('[GmailIntegration] OAuth callback received', { oauthResult });
      if (oauthResult !== 'connected') {
        if (oauthResult === 'failed') Alert.alert('Could not connect Gmail', 'Try again.');
        return;
      }
      await refresh();
      haptics.success();
    } catch (error) {
      console.error('[GmailIntegration] OAuth flow failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });
      haptics.impact();
      Alert.alert('Could not connect Gmail', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const runDisconnectGmail = async () => {
    haptics.selection();
    setBusyKey('gmail');
    try {
      await disconnectGmailIntegration(getToken);
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not disconnect Gmail',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const runConnectSms = async () => {
    haptics.impact();
    setBusyKey('sms');
    const result = await connectSmsInbox();
    setBusyKey(null);
    if (!result.ok) {
      haptics.impact();
      Alert.alert('SMS unavailable', result.error);
      return;
    }
    setState(result.state);
    haptics.success();
  };

  const runDisconnect = async (
    key: 'calendar' | 'sms',
    action: () => Promise<IntegrationsState>,
  ) => {
    haptics.selection();
    setBusyKey(key);
    setState(await action());
    setBusyKey(null);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior='automatic'
    >
      <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
        Integrations
      </Text>
      <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
        Connect tools so Finora can surface invoices, due dates, and payment requests for you.
      </Text>

      <IntegrationCard
        title='Gmail'
        detail={
          gmailStatusError
            ? 'Could not refresh Gmail status'
            : state.gmailConnected
              ? `Connected as ${state.gmailEmail ?? 'account'}`
              : 'Find unpaid invoices from suppliers'
        }
        connected={state.gmailConnected}
        icon={<GmailLogo width={22} />}
        busy={busyKey === 'gmail'}
        connectLabel='Connect Gmail'
        onConnect={() => void runConnectGmail()}
        onDisconnect={() => void runDisconnectGmail()}
        connectedBody={
          <>
            <Text className='font-sans-semibold text-[15px] text-foreground'>
              {gmail?.status === 'syncing'
                ? 'Scanning recent messages for invoice candidates'
                : `${gmail?.candidateCount ?? 0} invoice candidate${gmail?.candidateCount === 1 ? '' : 's'} found`}
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('Find unpaid invoices from suppliers');
                aui.composer.send();
              }}
              className='min-h-[46px] items-center justify-center rounded-[32px] bg-foreground px-3'
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-background'>Review in chat</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setBusyKey('gmail');
                void syncGmailIntegration(getToken)
                  .then(refresh)
                  .catch((error) =>
                    Alert.alert(
                      'Could not sync Gmail',
                      error instanceof Error ? error.message : 'Try again.',
                    ),
                  )
                  .finally(() => setBusyKey(null));
              }}
              disabled={busyKey === 'gmail'}
              className='min-h-[46px] items-center justify-center rounded-[32px] border border-border px-3'
              style={({ pressed }) => ({ opacity: pressed || busyKey === 'gmail' ? 0.7 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>Sync now</Text>
            </Pressable>
            <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
              In chat, say “Find unpaid invoices” or open Invoices in the drawer.
            </Text>
          </>
        }
      />

      <IntegrationCard
        title='Google Drive'
        detail={
          driveStatus?.connected
            ? `Connected as ${driveStatus.email ?? 'account'}`
            : 'Find contracts, receipts, and financial documents'
        }
        connected={driveStatus?.connected ?? false}
        icon={<GoogleDriveLogo />}
        busy={busyKey === 'drive'}
        connectLabel='Connect Google Drive'
        onConnect={() => void runConnectDrive()}
        onDisconnect={() => void runDisconnectDrive()}
        connectedBody={
          <Text className='font-sans-semibold text-[15px] text-foreground'>
            {driveStatus?.fileCount ?? 0} files indexed. Ask Finora to find a document in chat.
          </Text>
        }
      />

      <IntegrationCard
        title='Google Calendar'
        detail={
          state.calendarConnected
            ? `Connected as ${state.calendarEmail ?? 'account'}`
            : 'Surface rent, payroll, and bill due dates'
        }
        connected={state.calendarConnected}
        icon={<GoogleCalendarLogo width={22} />}
        busy={busyKey === 'calendar'}
        connectLabel='Connect Calendar'
        onConnect={() => void runConnectCalendar()}
        onDisconnect={() => void runDisconnectCalendar()}
        connectedBody={
          <>
            <Text className='font-sans-semibold text-[15px] text-foreground'>
              {calendarStatus?.status === 'syncing'
                ? 'Syncing upcoming calendar events'
                : `${calendarStatus?.eventCount ?? calendarCount} calendar event${(calendarStatus?.eventCount ?? calendarCount) === 1 ? '' : 's'} synced`}
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('What’s due on my calendar this week?');
                aui.composer.send();
              }}
              className='min-h-[46px] items-center justify-center rounded-[32px] bg-foreground px-3'
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-background'>Ask in chat</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setBusyKey('calendar');
                void syncCalendarIntegration(getToken)
                  .then(refresh)
                  .catch((error) =>
                    Alert.alert(
                      'Could not sync Calendar',
                      error instanceof Error ? error.message : 'Try again.',
                    ),
                  )
                  .finally(() => setBusyKey(null));
              }}
              disabled={busyKey === 'calendar'}
              className='min-h-[46px] items-center justify-center rounded-[32px] border border-border px-3'
              style={({ pressed }) => ({ opacity: pressed || busyKey === 'calendar' ? 0.7 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>Sync now</Text>
            </Pressable>
            <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
              Finora can prepare payments around due dates — it still needs your approval.
            </Text>
          </>
        }
      />

      <IntegrationCard
        title='SMS'
        detail={
          state.smsConnected
            ? `Connected to ${state.smsPhone ?? 'this device'}`
            : 'Catch MoMo prompts and payment asks from SMS'
        }
        connected={state.smsConnected}
        icon={<IMessageLogo width={22} />}
        busy={busyKey === 'sms'}
        connectLabel='Connect SMS'
        onConnect={() => void runConnectSms()}
        onDisconnect={() => void runDisconnect('sms', () => disconnectSmsInbox())}
        connectedBody={
          <>
            <Text className='font-sans-semibold text-[15px] text-foreground'>
              {smsCount} open payment request{smsCount === 1 ? '' : 's'} in SMS
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('Show payment requests from my SMS inbox');
                aui.composer.send();
              }}
              className='min-h-[46px] items-center justify-center rounded-[32px] bg-foreground px-3'
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-background'>Ask in chat</Text>
            </Pressable>
            <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
              SMS composer is ready on this device. Ask in chat for MoMo prompts, or tap Text SMS on
              payment links to share them.
            </Text>
          </>
        }
      />
    </ScrollView>
  );
}
