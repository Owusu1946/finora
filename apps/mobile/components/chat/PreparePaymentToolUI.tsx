import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { PaymentConfirmationStatus } from '@/components/chat/PaymentConfirmationCard';
import type { PurposeCode, SettlementMethod } from '@/lib/send-corridors';

import { SendMoneyWizard, type SendMoneySeed } from '@/components/chat/SendMoneyWizard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp, paymentSentFollowUp } from '@/lib/agent-follow-up';
import { findContactByIdentifier, saveContact } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type PreparePaymentArgs = Omit<SendMoneySeed, 'amount'> & {
  amount?: number | { amount: number; currency: string };
  currency?: string;
  recipientName?: string;
  destinationKind?: 'mobile_money' | 'bank_account' | 'crypto_wallet';
  destinationLabel?: string;
  destinationValue?: string;
  reference?: string;
  destinationCountry?: string;
  settlementMethod?: SettlementMethod;
  purposeCode?: PurposeCode;
  fundingCurrency?: string;
};

type PreparePaymentResult = {
  status?: PaymentConfirmationStatus | 'pending' | 'confirmed';
  preparationId?: string;
  transactionId?: string;
};

function PreparingCard() {
  const { colors } = useTheme();
  return (
    <View
      className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
      style={[styles.preparing]}
    >
      <LoadingIcon color={colors.mutedForeground} />
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

function normalizeSeed(args: PreparePaymentArgs): SendMoneySeed {
  if (typeof args.amount !== 'object' || args.amount === null) return args as SendMoneySeed;
  return {
    ...args,
    amount: args.amount.amount,
    currency: args.amount.currency,
  };
}

function PreparePaymentFlow({
  seed,
  resultStatus,
  preparationId,
  resultTransactionId,
  onFinished,
  onCancelled,
}: {
  seed: SendMoneySeed;
  resultStatus: PreparePaymentResult['status'] | undefined;
  preparationId: string;
  resultTransactionId?: string;
  onFinished: (payload: { preparationId: string; transactionId: string; status: 'sent' }) => void;
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
  const [confirmedPayment, setConfirmedPayment] = useState<
    import('@/components/chat/PaymentConfirmationCard').PaymentConfirmation | null
  >(null);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const status = resolveStatus(resultStatus, localStatus);
  const payment = confirmedPayment;

  useEffect(() => {
    const value = payment?.destination.value;
    if (!value) return;
    void findContactByIdentifier(value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [payment?.destination.value]);

  useEffect(() => {
    if (status !== 'sending' || !payment) return;

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
      <SendMoneyWizard
        seed={seed}
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
          if (!payment || contactSaved || contactSaving) return;
          setContactSaving(true);
          try {
            await saveContact({
              name: payment.recipientName,
              currency: payment.currency as never,
              method: payment.settlementMethodLabel ?? payment.destination.label,
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
        onConfirm={async (next) => {
          if (status !== 'pending' || busy) return;
          setConfirmedPayment(next);
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

export const PreparePaymentToolUI = makeAssistantToolUI<PreparePaymentArgs, PreparePaymentResult>({
  toolName: 'prepare_payment',
  display: 'standalone',
  render: ({ args, result, status, addResult }) => {
    const requiresPlatformPreparation = typeof args?.amount === 'object' && args.amount !== null;
    if (requiresPlatformPreparation && !result?.preparationId) return <PreparingCard />;

    const hasArgs =
      args != null &&
      (args.amount != null ||
        Boolean(args.destinationValue) ||
        Boolean(args.destinationCountry) ||
        Boolean(args.settlementMethod));
    if (status.type === 'running' && !hasArgs) {
      return <PreparingCard />;
    }

    const seed = normalizeSeed(args ?? {});
    const preparationId = result?.preparationId ?? `prep_${Date.now()}`;

    return (
      <PreparePaymentFlow
        seed={seed}
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

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
};
