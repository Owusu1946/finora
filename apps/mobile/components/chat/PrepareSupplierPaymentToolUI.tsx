import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Supplier } from '@/lib/suppliers-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type PrepareSupplierPaymentArgs = {
  supplierId?: string;
  supplierName?: string;
  amount?: { amount: number; currency: string } | number;
  currency?: string;
  reference?: string;
};

type PrepareSupplierPaymentResult = {
  supplier?: Supplier;
  amount?: number;
  currency?: string;
  reference?: string;
  preparationId?: string;
};

function mockTransactionId() {
  return `WW-SUP-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function SupplierPaymentCard({
  supplier,
  amount,
  currency,
  reference,
}: {
  supplier: Supplier;
  amount: number;
  currency: string;
  reference?: string;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      await recordSentPayment({
        payment: {
          amount,
          currency,
          recipientName: supplier.name,
          destination: {
            kind: supplier.destination.kind,
            label: supplier.destination.label,
            value: supplier.destination.value,
          },
          reference: reference ?? `Supplier · ${supplier.name}`,
          purposeCode: 'INVOICE',
          purposeLabel: 'Invoice / supplier',
        },
        transactionId: txId,
        source: 'chat',
      });
      setPhase('sent');
      haptics.success();
      appendAgentFollowUp(
        aui,
        `Paid ${supplier.name} ${formatPaymentAmount(amount, currency)}. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [amount, aui, currency, phase, reference, supplier]);

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            {phase === 'sending' ? (
              <LoadingIcon
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={phase === 'sent' ? 'check' : 'bank'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'sent'
                ? 'Supplier paid'
                : phase === 'sending'
                  ? 'Paying supplier…'
                  : 'Supplier payment ready'}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{supplier.name}</Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {supplier.destination.label} · {supplier.destination.value}
          </Text>
          {reference ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              Ref {reference}
            </Text>
          ) : null}
        </View>

        {phase === 'idle' ? (
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
              {
                backgroundColor: colors.foreground,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>Approve payment</Text>
          </Pressable>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const PrepareSupplierPaymentToolUI = makeAssistantToolUI<
  PrepareSupplierPaymentArgs,
  PrepareSupplierPaymentResult
>({
  toolName: 'prepare_supplier_payment',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const supplier = result?.supplier;
    const amount = result?.amount;
    const currency = result?.currency;

    if (status.type === 'running' && !supplier) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Preparing supplier payment…
          </Text>
        </View>
      );
    }

    if (!supplier || amount == null || !currency) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Couldn’t prepare that supplier payment. Try “Pay TechFlow 780 GBP”.
          </Text>
        </View>
      );
    }

    return (
      <SupplierPaymentCard
        supplier={supplier}
        amount={amount}
        currency={currency}
        reference={result?.reference}
      />
    );
  },
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  preparingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  empty: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
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
  btn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
