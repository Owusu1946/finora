import { useAui } from '@assistant-ui/react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { RecurringFrequency, RecurringPayment } from '@/components/recurring/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import {
  createRecurring,
  getRecurringSchedule,
  updateRecurringStatus,
} from '@/lib/recurring-storage';

export type RecurringDraft = {
  recipientName: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  destination: RecurringPayment['destination'];
  reference?: string;
  nextRunAt?: string;
};

type RecurringPaymentCardProps = {
  draft: RecurringDraft;
  /** The schedule chat saved as a draft; confirming activates it. */
  recurringId?: string;
  onCreated?: (payment: RecurringPayment) => void;
  onCancelled?: () => void;
  /** Already-created payment (read-only summary) */
  existing?: RecurringPayment;
};

const FREQ_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every quarter',
};

function defaultNextRun(frequency: RecurringFrequency) {
  const d = new Date();
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function RecurringPaymentCard({
  draft,
  recurringId,
  onCreated,
  onCancelled,
  existing,
}: RecurringPaymentCardProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<RecurringPayment | null>(existing ?? null);
  const [cancelled, setCancelled] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // The chat may be reopened after confirming: show the schedule as it is now.
  useEffect(() => {
    if (!recurringId || existing) return;
    let disposed = false;
    void getRecurringSchedule(recurringId)
      .then((schedule) => {
        if (disposed) return;
        if (schedule.status === 'cancelled') setCancelled(true);
        else if (schedule.status !== 'draft') {
          setCreated({
            ...schedule,
            status: schedule.status,
            reference: schedule.reference ?? undefined,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [existing, recurringId]);

  const nextRun = created?.nextRunAt ?? draft.nextRunAt ?? defaultNextRun(draft.frequency);

  return (
    <>
      <View
        className='w-[100%] border p-5 gap-4 my-2 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-full items-center justify-center bg-muted'>
            <Icon
              name='reload'
              size={16}
              color={colors.foreground}
            />
          </View>
          <View className='flex-1 gap-0.5'>
            <Text className='font-sans-medium text-[14px] text-muted-foreground'>
              {cancelled
                ? 'Cancelled'
                : created
                  ? 'Recurring payment active'
                  : 'Schedule recurring payment'}
            </Text>
            <Text className='font-sans-semibold text-[27px] tracking-[-0.6px] text-foreground'>
              {formatPaymentAmount(draft.amount, draft.currency)}
            </Text>
          </View>
        </View>

        <View className='h-px bg-border' />

        <View className='gap-2.5'>
          <Row
            label='To'
            value={draft.recipientName}
            colors={colors}
          />
          <Row
            label='Cadence'
            value={FREQ_LABEL[draft.frequency]}
            colors={colors}
          />
          <Row
            label='Next run'
            value={new Date(nextRun).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            colors={colors}
          />
          <Row
            label={draft.destination.label}
            value={draft.destination.value}
            colors={colors}
          />
          {draft.reference ? (
            <Row
              label='Reference'
              value={draft.reference}
              colors={colors}
            />
          ) : null}
        </View>

        {error ? (
          <Text className='font-sans-medium text-[14px] text-destructive'>{error}</Text>
        ) : null}

        {!created && !cancelled ? (
          <View className='flex-row gap-2.5'>
            <Pressable
              disabled={busy}
              onPress={() => {
                haptics.selection();
                setCancelled(true);
                if (recurringId) void updateRecurringStatus(recurringId, 'cancelled');
                onCancelled?.();
              }}
              className='flex-1 min-h-[46px] items-center justify-center rounded-full bg-muted px-4 active:opacity-75'
              style={({ pressed }) => [
                { backgroundColor: colors.muted, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.impact();
                setBusy(true);
                const ok = await requestApproval();
                setBusy(false);
                if (!ok) return;

                let payment: RecurringPayment | null;
                try {
                  payment = recurringId
                    ? await updateRecurringStatus(recurringId, 'active')
                    : await createRecurring({
                        recipientName: draft.recipientName,
                        amount: draft.amount,
                        currency: draft.currency,
                        frequency: draft.frequency,
                        destination: draft.destination,
                        reference: draft.reference,
                        nextRunAt: nextRun,
                      });
                } catch {
                  payment = null;
                }
                if (!payment) {
                  haptics.error();
                  setError("Couldn't save the schedule. Try again.");
                  return;
                }
                setError(null);
                setCreated(payment);
                onCreated?.(payment);
                haptics.success();
                appendAgentFollowUp(
                  aui,
                  `Scheduled ${formatPaymentAmount(draft.amount, draft.currency)} to ${draft.recipientName} ${FREQ_LABEL[draft.frequency].toLowerCase()}, starting ${new Date(payment.nextRunAt).toLocaleDateString()}. On each due date I'll prepare it in your Automations chat for you to approve. Manage it under Recurring in the drawer.`,
                );
              }}
              className='flex-1 min-h-[46px] items-center justify-center rounded-full px-4 bg-primary active:opacity-85 disabled:opacity-50'
              style={({ pressed }) => [
                { backgroundColor: colors.primary, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              <Text
                style={{ color: colors.primaryForeground }}
                className='font-sans-semibold text-[16px] tracking-[-0.2px] text-primary-foreground'
              >
                {busy ? <LoadingIcon color={colors.background} /> : 'Confirm schedule'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

function Row({
  label,
  value,
  colors: _colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View className='gap-0.5'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text className='font-sans-medium text-[16px] tracking-[-0.2px] text-foreground'>
        {value}
      </Text>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
};
