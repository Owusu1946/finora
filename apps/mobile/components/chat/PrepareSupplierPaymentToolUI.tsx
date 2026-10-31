import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Supplier } from '@/lib/suppliers-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { actionErrorMessage, executeAction, getAction, prepareAction } from '@/lib/actions-api';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';

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
  /** The prepared payment on the Finora API; it executes only after the passcode. */
  actionId?: string;
  preparationId?: string;
};

function SupplierPaymentCard({
  supplier,
  amount,
  currency,
  reference,
  actionId,
}: {
  supplier: Supplier;
  amount: number;
  currency: string;
  reference?: string;
  actionId?: string;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const finishedRef = useRef(false);

  // The chat may be reopened after paying: show what really happened.
  useEffect(() => {
    if (!actionId) return;
    let cancelled = false;
    void getAction(actionId)
      .then((action) => {
        if (cancelled || action.status !== 'executed') return;
        finishedRef.current = true;
        setPhase('sent');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      try {
        const id =
          actionId ??
          (
            await prepareAction({
              kind: 'payment',
              recipientName: supplier.name,
              amount,
              currency,
              destination: {
                kind: supplier.destination.kind,
                label: supplier.destination.label,
                value: supplier.destination.value,
              },
              reference: reference ?? `Supplier · ${supplier.name}`,
              purpose: 'supplier',
            })
          ).id;
        const action = await executeAction(id);
        if (cancelled || finishedRef.current) return;
        finishedRef.current = true;
        setPhase('sent');
        haptics.success();
        appendAgentFollowUp(
          aui,
          `Paid ${supplier.name} ${formatPaymentAmount(amount, currency)}. Ref ${action.transactionId ?? action.id}.`,
        );
      } catch (error) {
        if (cancelled) return;
        haptics.error();
        setPhase('idle');
        appendAgentFollowUp(
          aui,
          `The payment to ${supplier.name} didn't go through. ${actionErrorMessage(error)}`,
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actionId, amount, aui, currency, phase, reference, supplier]);

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
                name={phase === 'sent' ? 'check' : 'bank'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View className='flex-1 gap-0.5 min-w-0'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {phase === 'sent'
                ? 'Supplier paid'
                : phase === 'sending'
                  ? 'Paying supplier…'
                  : 'Supplier payment ready'}
            </Text>
            <Text className='font-sans-semibold text-[16px] text-foreground'>{supplier.name}</Text>
          </View>
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>

        <View className='gap-1'>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            {supplier.destination.label} · {supplier.destination.value}
          </Text>
          {reference ? (
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
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
            className='min-h-11 rounded-full items-center justify-center px-5 bg-primary active:opacity-85 disabled:opacity-50'
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
              Approve payment
            </Text>
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
  render: function PrepareSupplierPaymentToolContent({ result, status }) {
    const { colors } = useTheme();
    const supplier = result?.supplier;
    const amount = result?.amount;
    const currency = result?.currency;

    if (status.type === 'running' && !supplier) {
      return (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 p-4 border-border bg-composer'
          style={[styles.preparing]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Preparing supplier payment…
          </Text>
        </View>
      );
    }

    if (!supplier || amount == null || !currency) {
      return (
        <View
          className='my-2 border p-4 border-border bg-composer'
          style={[styles.empty]}
        >
          <Text className='font-sans-medium text-[15px] leading-[20px] text-muted-foreground'>
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
        actionId={result?.actionId}
      />
    );
  },
});

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
  empty: {
    borderRadius: Radius.card,
  },
  card: {
    borderRadius: Radius.card,
  },
};
