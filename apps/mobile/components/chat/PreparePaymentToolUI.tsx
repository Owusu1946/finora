import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  PaymentConfirmationCard,
  type PaymentConfirmation,
  type PaymentConfirmationStatus,
  type PaymentDestinationKind,
} from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { useTheme } from '@/hooks/use-theme';
import {
  appendAgentFollowUp,
  paymentSentFollowUp,
} from '@/lib/agent-follow-up';
import { findContactByIdentifier, saveContact } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type PreparePaymentArgs = {
  amount?: number;
  currency?: string;
  recipientName?: string;
  destinationKind?: PaymentDestinationKind;
  destinationLabel?: string;
  destinationValue?: string;
  reference?: string;
};

type PreparePaymentResult = {
  status?: PaymentConfirmationStatus | 'pending' | 'confirmed';
  preparationId?: string;
  transactionId?: string;
};

function asPayment(args: PreparePaymentArgs): PaymentConfirmation {
  return {
    amount: typeof args.amount === 'number' ? args.amount : 0,
    currency: args.currency ?? 'GHS',
    recipientName: args.recipientName ?? 'Recipient',
    destination: {
      kind: args.destinationKind ?? 'mobile_money',
      label: args.destinationLabel ?? 'Destination',
      value: args.destinationValue ?? '—',
    },
    reference: args.reference,
  };
}

function PreparingCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.preparing,
        { borderColor: colors.border, backgroundColor: colors.composer },
      ]}
    >
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  );
}

function mockTransactionId() {
  const n = Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return `WW-${n}`;
}

function resolveStatus(
  resultStatus: PreparePaymentResult['status'] | undefined,
  local: PaymentConfirmationStatus | null,
): PaymentConfirmationStatus {
  if (local) return local;
  if (resultStatus === 'sent') return 'sent';
  if (resultStatus === 'sending') return 'sending';
  if (resultStatus === 'cancelled') return 'cancelled';
  if (resultStatus === 'failed') return 'failed';
  if (resultStatus === 'confirmed') return 'sending';
  return 'pending';
}

function PreparePaymentConfirm({
  payment,
  resultStatus,
  preparationId,
  resultTransactionId,
  onFinished,
  onCancelled,
}: {
  payment: PaymentConfirmation;
  resultStatus: PreparePaymentResult['status'] | undefined;
  preparationId: string;
  resultTransactionId?: string;
  onFinished: (payload: {
    preparationId: string;
    transactionId: string;
    status: 'sent';
  }) => void;
  onCancelled: () => void;
}) {
  const aui = useAui();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<PaymentConfirmationStatus | null>(null);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState(resultTransactionId);
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const status = resolveStatus(resultStatus, localStatus);

  useEffect(() => {
    void findContactByIdentifier(payment.destination.value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [payment.destination.value]);

  useEffect(() => {
    if (status !== 'sending') return;

    let cancelled = false;
    const run = async () => {
      for (let step = 0; step < 3; step++) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
      }
      if (cancelled || finishedRef.current) return;
      const txId = resultTransactionId ?? mockTransactionId();
      finishedRef.current = true;
      setTransactionId(txId);
      setLocalStatus('sent');
      haptics.success();
      onFinishedRef.current({ preparationId, transactionId: txId, status: 'sent' });

      const recorded = await recordSentPayment({
        payment,
        transactionId: txId,
        source: 'chat',
      });
      if (!cancelled) setTxRecordId(recorded.id);

      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(aui, paymentSentFollowUp(payment, txId));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, payment, preparationId, resultTransactionId, status]);

  return (
    <>
      <PaymentConfirmationCard
        payment={payment}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        contactSaved={contactSaved}
        contactSaving={contactSaving}
        onViewDetails={
          status === 'sent' && (txRecordId || transactionId)
            ? () => {
                router.push(`/transaction/${txRecordId ?? transactionId}` as Href);
              }
            : undefined
        }
        onSaveContact={async () => {
          if (contactSaved || contactSaving) return;
          setContactSaving(true);
          try {
            await saveContact({
              name: payment.recipientName,
              currency: payment.currency,
              method: payment.destination.label,
              identifier: payment.destination.value,
            });
            setContactSaved(true);
            haptics.success();
            appendAgentFollowUp(
              aui,
              `Saved ${payment.recipientName} to your contacts. Next time you can just say “Pay ${payment.recipientName}”. What else do you want to do?`,
            );
          } finally {
            setContactSaving(false);
          }
        }}
        onConfirm={async () => {
          if (status !== 'pending' || busy) return;
          setBusy(true);
          const ok = await requestApproval();
          setBusy(false);
          if (!ok) return;
          setSendingStep(0);
          setLocalStatus('sending');
        }}
        onCancel={() => {
          if (status !== 'pending' || busy) return;
          onCancelled();
        }}
      />
      {modal}
    </>
  );
}

export const PreparePaymentToolUI = makeAssistantToolUI<
  PreparePaymentArgs,
  PreparePaymentResult
>({
  toolName: 'prepare_payment',
  display: 'standalone',
  render: ({ args, result, status, addResult }) => {
    const hasArgs = args != null && (args.amount != null || Boolean(args.destinationValue));
    if (status.type === 'running' && !hasArgs) {
      return <PreparingCard />;
    }

    const payment = asPayment(args ?? {});
    const preparationId = result?.preparationId ?? `prep_${Date.now()}`;

    return (
      <PreparePaymentConfirm
        payment={payment}
        resultStatus={result?.status}
        preparationId={preparationId}
        resultTransactionId={result?.transactionId}
        onFinished={({ preparationId: id, transactionId, status: next }) => {
          addResult({ status: next, preparationId: id, transactionId });
        }}
        onCancelled={() => {
          addResult({ status: 'cancelled' });
        }}
      />
    );
  },
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
