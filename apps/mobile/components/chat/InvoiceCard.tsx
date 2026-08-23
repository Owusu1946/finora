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

function formatDue(iso: string | null | undefined) {
  if (!iso) return 'Not specified';
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
      const destination = invoice.destination;
      if (!destination) return;
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
          destination,
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
      <View
        className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
        style={[styles.card]}
      >
        <View className='flex-row items-center gap-3'>
          <Animated.View
            className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'
            style={[{ opacity: phase === 'sending' ? pulse : 1 }]}
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
          <View className='flex-1 gap-0.5'>
            <Text className='font-sans-medium text-[14px] text-muted-foreground'>
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
            <Text className='font-sans-semibold text-[25px] tracking-[-0.5px] text-foreground'>
              {formatPaymentAmount(invoice.amount, invoice.currency)}
            </Text>
          </View>
          <View
            className='px-2.5 py-[5px] bg-muted'
            style={[styles.sourcePill]}
          >
            <Text className='font-sans-semibold text-[12px] capitalize text-muted-foreground'>
              {invoice.source === 'gmail' ? 'Gmail' : invoice.source}
            </Text>
          </View>
        </View>

        <View
          className='w-[100%] bg-border'
          className='h-px bg-border'
        />

        <View className='gap-2.5'>
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
          {invoice.destination ? (
            <Row
              label={invoice.destination.label}
              value={invoice.destination.value}
              colors={colors}
            />
          ) : (
            <Row
              label='Payment details'
              value='Not available from this invoice email'
              colors={colors}
            />
          )}
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
          <View className='gap-2.5'>
            {SEND_STEPS.map((label, index) => {
              const done = index < sendingStep;
              const active = index === sendingStep;
              return (
                <View
                  key={label}
                  className='flex-row items-center gap-2.5'
                >
                  <View
                    className='w-[22px] h-[22px] rounded-[11px] border items-center justify-center'
                    style={[
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
                    className='font-sans text-[15px]'
                    style={[
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

        {due && invoice.destination ? (
          <View className='flex-row gap-2.5'>
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
              className='flex-1 min-h-[46px] items-center justify-center border'
              style={({ pressed }) => [
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] text-foreground'>Dismiss</Text>
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
              className='flex-1 min-h-[46px] items-center justify-center'
              style={({ pressed }) => [
                { backgroundColor: colors.foreground, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              <Text className='font-sans-semibold text-[16px] text-background'>
                {busy ? '…' : 'Pay now'}
              </Text>
            </Pressable>
          </View>
        ) : due ? (
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            Add verified supplier payment details before preparing payment.
          </Text>
        ) : null}

        {paid && (txRecordId || transactionId) ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push(`/transaction/${txRecordId ?? transactionId}` as Href);
            }}
            className='min-h-11 border flex-row items-center justify-center gap-2'
            style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Icon
              name='activity'
              size={16}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] text-foreground'>View transaction</Text>
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
    <View className='gap-0.5'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text
        className='font-sans-medium text-[16px] tracking-[-0.2px] text-foreground'

        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  sourcePill: {
    borderRadius: Radius.pill,
  },
  btn: {
    borderRadius: Radius.composer,
  },
  linkBtn: {
    borderRadius: Radius.composer,
  },
};
