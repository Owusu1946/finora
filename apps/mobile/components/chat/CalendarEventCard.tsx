import { useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import {
  dismissCalendarEvent,
  markCalendarEventPaid,
  type CalendarMoneyEvent,
} from '@/lib/calendar-events-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

function mockTransactionId() {
  return `WW-CAL-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function kindLabel(kind: CalendarMoneyEvent['kind']) {
  if (kind === 'rent') return 'Rent';
  if (kind === 'payroll') return 'Payroll';
  if (kind === 'bill') return 'Bill';
  if (kind === 'subscription') return 'Subscription';
  return 'Money event';
}

export function CalendarEventCard({ event: initial }: { event: CalendarMoneyEvent }) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [event, setEvent] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'paid' | 'dismissed'>(
    initial.status === 'paid' ? 'paid' : initial.status === 'dismissed' ? 'dismissed' : 'idle',
  );
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      const updated = await markCalendarEventPaid(event.id, txId);
      if (updated) setEvent(updated);
      setPhase('paid');
      haptics.success();
      if (event.amount && event.currency && event.counterparty) {
        await recordSentPayment({
          payment: {
            amount: event.amount,
            currency: event.currency,
            recipientName: event.counterparty,
            destination: {
              kind: 'bank_account',
              label: 'Calendar payment',
              value: event.title,
            },
            reference: event.title,
          },
          transactionId: txId,
          source: 'chat',
        });
      }
      appendAgentFollowUp(
        aui,
        `Paid ${event.title}${
          event.amount && event.currency
            ? ` (${formatPaymentAmount(event.amount, event.currency)})`
            : ''
        }. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, event, phase]);

  const idle = phase === 'idle';
  const canPay = idle && event.amount != null && event.currency && event.counterparty;

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            {phase === 'sending' ? (
              <ActivityIndicator
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={phase === 'paid' ? 'check' : 'activity'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'paid'
                ? 'Paid from calendar'
                : phase === 'sending'
                  ? 'Paying…'
                  : phase === 'dismissed'
                    ? 'Dismissed'
                    : kindLabel(event.kind)}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{event.title}</Text>
          </View>
          {event.amount != null && event.currency ? (
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatPaymentAmount(event.amount, event.currency)}
            </Text>
          ) : null}
        </View>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            Due {formatDue(event.dueAt)}
          </Text>
          {event.counterparty ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {event.counterparty}
            </Text>
          ) : null}
          {event.notes ? (
            <Text style={[styles.notes, { color: colors.mutedForeground }]}>{event.notes}</Text>
          ) : null}
        </View>

        {idle ? (
          <View style={styles.actions}>
            {canPay ? (
              <Pressable
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const ok = await requestApproval();
                  setBusy(false);
                  if (!ok) return;
                  setPhase('sending');
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed || busy ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnLabel, { color: colors.background }]}>Pay now</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                setBusy(true);
                const updated = await dismissCalendarEvent(event.id);
                if (updated) setEvent(updated);
                setPhase('dismissed');
                setBusy(false);
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    gap: 4,
  },
  metaText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  notes: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
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
});
