import type { CalendarIntegrationStatus, GmailIntegrationStatus } from '@finora/shared';

import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GmailLogo } from '@/components/integrations/gmail-logo';
import { GoogleCalendarLogo } from '@/components/integrations/google-calendar-logo';
import { IMessageLogo } from '@/components/integrations/imessage-logo';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listUpcomingCalendarMoneyEvents } from '@/lib/calendar-events-storage';
import {
  beginCalendarConnection,
  disconnectCalendarIntegration,
  getCalendarIntegrationStatus,
  syncCalendarIntegration,
} from '@/lib/calendar-integration-api';
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
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          {icon}
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.cardDetail, { color: colors.mutedForeground }]}>{detail}</Text>
        </View>
        <View
          style={[styles.statusDot, { backgroundColor: connected ? '#10B981' : colors.border }]}
        />
      </View>

      {connected ? (
        <View style={styles.connectedBody}>
          {connectedBody}
          <Pressable
            disabled={busy}
            onPress={onDisconnect}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGhost,
              { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          disabled={busy}
          onPress={onConnect}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity: pressed || busy ? 0.85 : 1,
              marginTop: 4,
            },
          ]}
        >
          <Text style={[styles.btnLabel, { color: colors.background }]}>
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
  const [busyKey, setBusyKey] = useState<'gmail' | 'calendar' | 'sms' | null>(null);
  const [gmail, setGmail] = useState<GmailIntegrationStatus | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarIntegrationStatus | null>(null);
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
      const [integrations, calendar, sms] = await Promise.all([
        getIntegrations(),
        listUpcomingCalendarMoneyEvents(),
        listOpenSmsPaymentRequests(),
      ]);
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
      const gmailStatus = gmailResult.value ?? gmailRef.current;
      if (calendarResult) setCalendarStatus(calendarResult);
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

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!state) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior='automatic'
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Integrations</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
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
            <Text style={[styles.found, { color: colors.foreground }]}>
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
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                {
                  backgroundColor: colors.foreground,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
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
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed || busyKey === 'gmail' ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Sync now</Text>
            </Pressable>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              In chat, say “Find unpaid invoices” or open Invoices in the drawer.
            </Text>
          </>
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
            <Text style={[styles.found, { color: colors.foreground }]}>
              {calendarStatus?.status === 'syncing'
                ? 'Syncing upcoming financial events'
                : `${calendarStatus?.eventCount ?? calendarCount} upcoming money event${(calendarStatus?.eventCount ?? calendarCount) === 1 ? '' : 's'} on calendar`}
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('What’s due on my calendar this week?');
                aui.composer.send();
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                {
                  backgroundColor: colors.foreground,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>Ask in chat</Text>
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
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                {
                  borderColor: colors.border,
                  opacity: pressed || busyKey === 'calendar' ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Sync now</Text>
            </Pressable>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
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
            <Text style={[styles.found, { color: colors.foreground }]}>
              {smsCount} open payment request{smsCount === 1 ? '' : 's'} in SMS
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('Show payment requests from my SMS inbox');
                aui.composer.send();
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                {
                  backgroundColor: colors.foreground,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>Ask in chat</Text>
            </Pressable>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              SMS composer is ready on this device. Ask in chat for MoMo prompts, or tap Text SMS on
              payment links to share them.
            </Text>
          </>
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: -4,
    marginBottom: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
  },
  cardDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedBody: {
    gap: 12,
  },
  found: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  btn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnPrimary: {},
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
