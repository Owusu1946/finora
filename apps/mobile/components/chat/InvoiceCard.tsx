import { useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import type { Invoice } from '@/components/invoices/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { dismissInvoice, markInvoicePaid } from '@/lib/invoices-storage';
import { recordSentPayment } from '@/lib/transactions-storage';

type InvoiceCardProps = {
  invoice: Invoice;
  onUpdated?: (invoice: Invoice) => void;
};

const SEND_STEPS = ['Authorizing', 'Paying supplier', 'Confirming'] as const;

function mockTransactionId() {
  const n = Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return `WW-${n}`;
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InvoiceCard({ invoice: initial, onUpdated }: InvoiceCardProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();

  const [invoice, setInvoice] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'paid' | 'dismissed'>(
    initial.status === 'paid' ? 'paid' : initial.status === 'dismissed' ? 'dismissed' : 'idle',
  );
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState(initial.transactionId);
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (phase !== 'sending') {
      pulse.setValue(0.45);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [phase, pulse]);

  useEffect(() => {
    if (phase !== 'sending') return;
    let cancelled = false;
    const run = async () => {
      for (let step = 0; step < 3; step++) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
      }
      if (cancelled || finishedRef.current) return;
      const txId = mockTransactionId();
      finishedRef.current = true;
      setTransactionId(txId);
      setPhase('paid');
      haptics.success();

      const updated = await markInvoicePaid(invoice.id, txId);
      if (updated) {
        setInvoice(updated);
        onUpdated?.(updated);
      }

      const recorded = await recordSentPayment({
        payment: {
          amount: invoice.amount,
          currency: invoice.currency,
          recipientName: invoice.vendor,
          destination: invoice.destination,
          reference: invoice.invoiceNumber,
        },
        transactionId: txId,
        source: 'chat',
      });
      if (!cancelled) setTxRecordId(recorded.id);

      appendAgentFollowUp(
        aui,
        `Paid ${invoice.invoiceNumber} to ${invoice.vendor} (${formatPaymentAmount(invoice.amount, invoice.currency)}). Ref ${txId}. Want to schedule this as a recurring payment?`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, invoice, onUpdated, phase]);

  const due = phase === 'idle' && invoice.status === 'due';
  const scheduled = phase === 'idle' && invoice.status === 'scheduled';
  const paid = phase === 'paid' || invoice.status === 'paid';
  const dismissed = phase === 'dismissed' || invoice.status === 'dismissed';

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.iconWrap,
              {
                backgroundColor: colors.muted,
                opacity: phase === 'sending' ? pulse : 1,
              },
            ]}
          >
            {phase === 'sending' ? (
              <LoadingIcon
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={paid ? 'check' : 'file'}
                size={16}
                color={colors.foreground}
              />
            )}
          </Animated.View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {paid
                ? 'Invoice paid'
                : phase === 'sending'
                  ? 'Paying…'
                  : dismissed
                    ? 'Dismissed'
                    : scheduled
                      ? 'Scheduled'
                      : 'Supplier invoice'}
            </Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatPaymentAmount(invoice.amount, invoice.currency)}
            </Text>
          </View>
          <View style={[styles.sourcePill, { backgroundColor: colors.muted }]}>
            <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>
              {invoice.source === 'gmail' ? 'Gmail' : invoice.source}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.rows}>
          <Row
            label='Vendor'
            value={invoice.vendor}
            colors={colors}
          />
          <Row
            label='Invoice'
            value={invoice.invoiceNumber}
            colors={colors}
          />
          <Row
            label='Due'
            value={formatDue(invoice.dueDate)}
            colors={colors}
          />
          <Row
            label={invoice.destination.label}
            value={invoice.destination.value}
            colors={colors}
          />
          {invoice.description ? (
            <Row
              label='Memo'
              value={invoice.description}
              colors={colors}
            />
          ) : null}
          {transactionId ? (
            <Row
              label='Transaction'
              value={transactionId}
              colors={colors}
            />
          ) : null}
        </View>

        {phase === 'sending' ? (
          <View style={styles.steps}>
            {SEND_STEPS.map((label, index) => {
              const done = index < sendingStep;
              const active = index === sendingStep;
              return (
                <View
                  key={label}
                  style={styles.stepRow}
                >
                  <View
                    style={[
                      styles.stepDot,
                      {
                        borderColor: done || active ? colors.foreground : colors.border,
                        backgroundColor: done ? colors.foreground : 'transparent',
                      },
                    ]}
                  >
                    {done ? (
                      <Icon
                        name='check'
                        size={10}
                        color={colors.background}
                      />
                    ) : active ? (
                      <LoadingIcon
                        size='small'
                        color={colors.foreground}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: done || active ? colors.foreground : colors.mutedForeground,
                        fontWeight: active ? '600' : '500',
                      },
                    ]}
                  >
                    {label}
                    {active ? '…' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {due ? (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                setBusy(true);
                await dismissInvoice(invoice.id);
                setPhase('dismissed');
                setInvoice((prev) => ({ ...prev, status: 'dismissed' }));
                onUpdated?.({ ...invoice, status: 'dismissed' });
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
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.impact();
                setBusy(true);
                const ok = await requestApproval();
                setBusy(false);
                if (!ok) return;
                setSendingStep(0);
                finishedRef.current = false;
                setPhase('sending');
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: colors.foreground, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>
                {busy ? '…' : 'Pay now'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {paid && (txRecordId || transactionId) ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push(`/transaction/${txRecordId ?? transactionId}` as Href);
            }}
            style={({ pressed }) => [
              styles.linkBtn,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Icon
              name='activity'
              size={16}
              color={colors.foreground}
            />
            <Text style={[styles.linkLabel, { color: colors.foreground }]}>View transaction</Text>
          </Pressable>
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
      <Text
        style={[styles.rowValue, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {value}
      </Text>
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
  sourcePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  sourceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
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
    letterSpacing: -0.2,
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
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  linkBtn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  linkLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
