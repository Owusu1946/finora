import { AppText as Text } from '@/components/ui/text';
import { useAui } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RecurringFrequency, RecurringPayment } from '@/components/recurring/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
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
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <Icon
              name='reload'
              size={16}
              color={colors.foreground}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {cancelled
                ? 'Cancelled'
                : created
                  ? 'Recurring payment active'
                  : 'Schedule recurring payment'}
            </Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatPaymentAmount(draft.amount, draft.currency)}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.rows}>
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
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => {
                haptics.selection();
                setCancelled(true);
                onCancelled?.();
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Cancel</Text>
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
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: colors.foreground, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>
                {busy ? '…' : 'Confirm schedule'}
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
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 8,
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
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  rows: {
    gap: 10,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  rowValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: {},
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
});
