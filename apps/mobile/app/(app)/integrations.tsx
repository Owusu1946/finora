import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GmailLogo } from '@/components/integrations/gmail-logo';
import { GoogleCalendarLogo } from '@/components/integrations/google-calendar-logo';
import { IMessageLogo } from '@/components/integrations/imessage-logo';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listUpcomingCalendarMoneyEvents } from '@/lib/calendar-events-storage';
import { haptics } from '@/lib/haptics';
import {
  connectGmail,
  connectGoogleCalendar,
  connectSmsInbox,
  disconnectGmail,
  disconnectGoogleCalendar,
  disconnectSmsInbox,
  getIntegrations,
  type IntegrationsState,
} from '@/lib/integrations-storage';
import { listDueInvoices } from '@/lib/invoices-storage';
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
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [state, setState] = useState<IntegrationsState | null>(null);
  const [busyKey, setBusyKey] = useState<'gmail' | 'calendar' | 'sms' | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [calendarCount, setCalendarCount] = useState(0);
  const [smsCount, setSmsCount] = useState(0);

  const refresh = useCallback(async () => {
    const [integrations, due, calendar, sms] = await Promise.all([
      getIntegrations(),
      listDueInvoices(),
      listUpcomingCalendarMoneyEvents(),
      listOpenSmsPaymentRequests(),
    ]);
    setState(integrations);
    setDueCount(due.length);
    setCalendarCount(calendar.length);
    setSmsCount(sms.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!state) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  const runConnect = async (
    key: 'gmail' | 'calendar' | 'sms',
    action: () => Promise<IntegrationsState>,
  ) => {
    haptics.impact();
    setBusyKey(key);
    await new Promise((r) => setTimeout(r, 700));
    setState(await action());
    setBusyKey(null);
    haptics.success();
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
    key: 'gmail' | 'calendar' | 'sms',
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
          state.gmailConnected
            ? `Connected as ${state.gmailEmail ?? 'account'}`
            : 'Find unpaid invoices from suppliers'
        }
        connected={state.gmailConnected}
        icon={<GmailLogo width={22} />}
        busy={busyKey === 'gmail'}
        connectLabel='Connect Gmail'
        onConnect={() => void runConnect('gmail', () => connectGmail())}
        onDisconnect={() => void runDisconnect('gmail', () => disconnectGmail())}
        connectedBody={
          <>
            <Text style={[styles.found, { color: colors.foreground }]}>
              {dueCount} unpaid invoice{dueCount === 1 ? '' : 's'} ready to review
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
        onConnect={() => void runConnect('calendar', () => connectGoogleCalendar())}
        onDisconnect={() => void runDisconnect('calendar', () => disconnectGoogleCalendar())}
        connectedBody={
          <>
            <Text style={[styles.found, { color: colors.foreground }]}>
              {calendarCount} upcoming money event{calendarCount === 1 ? '' : 's'} on calendar
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
              SMS composer is ready on this device. Ask in chat for MoMo prompts, or tap Text SMS
              on payment links to share them.
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
