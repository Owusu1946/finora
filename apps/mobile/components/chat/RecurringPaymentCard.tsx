import { useAui } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { saveRecurring } from '@/lib/recurring-storage';

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

  const nextRun = created?.nextRunAt ?? draft.nextRunAt ?? defaultNextRun(draft.frequency);

  return (
    <>
      <View
        className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
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
            <Text className='font-sans-semibold text-[25px] tracking-[-0.5px] text-foreground'>
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

        {!created && !cancelled ? (
          <View className='flex-row gap-2.5'>
            <Pressable
              disabled={busy}
              onPress={() => {
                haptics.selection();
                setCancelled(true);
                onCancelled?.();
              }}
              className='flex-1 min-h-[46px] items-center justify-center border'
              style={({ pressed }) => [
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] text-foreground'>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.impact();
                setBusy(true);
                const ok = await requestApproval();
                setBusy(false);
                if (!ok) return;

                const payment: RecurringPayment = {
                  id: `rec-${Date.now()}`,
                  recipientName: draft.recipientName,
                  amount: draft.amount,
                  currency: draft.currency,
                  frequency: draft.frequency,
                  nextRunAt: nextRun,
                  status: 'active',
                  destination: draft.destination,
                  reference: draft.reference,
                  createdAt: new Date().toISOString(),
                };
                await saveRecurring(payment);
                setCreated(payment);
                onCreated?.(payment);
                haptics.success();
                appendAgentFollowUp(
                  aui,
                  `Scheduled ${formatPaymentAmount(draft.amount, draft.currency)} to ${draft.recipientName} ${FREQ_LABEL[draft.frequency].toLowerCase()}. Next run ${new Date(nextRun).toLocaleDateString()}. Manage it under Recurring in the drawer.`,
                );
              }}
              className='flex-1 min-h-[46px] items-center justify-center'
              style={({ pressed }) => [
                { backgroundColor: colors.foreground, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] text-background'>
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
  colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View className='gap-0.5'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text className='font-sans-medium text-[16px] text-foreground'>{value}</Text>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  btn: {
    borderRadius: Radius.composer,
  },
};
