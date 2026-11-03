import { useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { actionErrorMessage, executeAction, prepareAction } from '@/lib/actions-api';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import {
  dismissCalendarEvent,
  markCalendarEventPaid,
  type CalendarMoneyEvent,
} from '@/lib/calendar-events-storage';
import { haptics } from '@/lib/haptics';

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
  return 'Calendar event';
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
      if (cancelled || finishedRef.current) return;
      if (!event.amount || !event.currency || !event.counterparty) {
        setPhase('idle');
        return;
      }
      finishedRef.current = true;
      try {
        const prepared = await prepareAction({
          kind: 'payment',
          recipientName: event.counterparty,
          amount: event.amount,
          currency: event.currency,
          destination: { kind: 'bank_account', label: 'Calendar payment', value: '' },
          reference: event.title.slice(0, 140),
          purpose: 'bill',
          relatedId: `calendar:${event.id}`,
        });
        const action = await executeAction(prepared.id);
        const txId = action.transactionId ?? action.id;
        const updated = await markCalendarEventPaid(event.id, txId);
        if (updated) setEvent(updated);
        setPhase('paid');
        haptics.success();
        appendAgentFollowUp(
          aui,
          `Paid ${event.title}${
            event.amount && event.currency
              ? ` (${formatPaymentAmount(event.amount, event.currency)})`
              : ''
          }. Ref ${txId}.`,
        );
      } catch (error) {
        finishedRef.current = false;
        haptics.error();
        setPhase('idle');
        appendAgentFollowUp(aui, `${event.title} wasn't paid. ${actionErrorMessage(error)}`);
      }
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
      <View
        className='w-[100%] border p-5 gap-4 my-2 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-full items-center justify-center bg-muted'>
            {phase === 'sending' ? (
              <LoadingIcon
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
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'paid'
                ? 'Paid from calendar'
                : phase === 'sending'
                  ? 'Paying…'
                  : phase === 'dismissed'
                    ? 'Dismissed'
                    : kindLabel(event.kind)}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>{event.title}</Text>
          </View>
          {event.amount != null && event.currency ? (
            <Text className='font-sans-semibold text-[16px] text-foreground'>
              {formatPaymentAmount(event.amount, event.currency)}
            </Text>
          ) : null}
        </View>

        <View className='gap-1'>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Starts {formatDue(event.dueAt)}
          </Text>
          {event.counterparty ? (
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
              {event.counterparty}
            </Text>
          ) : null}
          {event.notes ? (
            <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
              {event.notes}
            </Text>
          ) : null}
        </View>

        {idle ? (
          <View className='flex-row gap-2.5'>
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
                className='flex-1 min-h-[46px] items-center justify-center rounded-full px-4 bg-primary active:opacity-85 disabled:opacity-40'
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || busy ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{ color: colors.primaryForeground }}
                  className='font-sans-semibold text-[16px] tracking-[-0.2px] text-primary-foreground'
                >
                  Pay now
                </Text>
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
              className='flex-1 min-h-[46px] items-center justify-center rounded-full px-3.5'
              style={({ pressed }) => [
                { backgroundColor: colors.muted, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                Dismiss
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
};
