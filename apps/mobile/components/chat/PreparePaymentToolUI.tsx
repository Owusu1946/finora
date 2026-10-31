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
import {
  actionErrorMessage,
  cancelAction,
  executeAction,
  getAction,
  prepareAction,
  updateAction,
} from '@/lib/actions-api';
import { appendAgentFollowUp, paymentSentFollowUp } from '@/lib/agent-follow-up';
import { findContactByIdentifier, saveContact } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';
import { paymentActionRequest } from '@/lib/payment-actions';

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
  /** The prepared payment on the Finora API; it executes only after the passcode. */
  actionId?: string;
  preparationId?: string;
  transactionId?: string;
  ok?: boolean;
  errorCode?: string;
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

const SEND_STEP_MS = 650;

function PreparePaymentFlow({
  seed,
  resultStatus,
  actionId: preparedActionId,
  resultTransactionId,
  onFinished,
  onCancelled,
}: {
  seed: SendMoneySeed;
  resultStatus: PreparePaymentResult['status'] | undefined;
  actionId?: string;
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
  const [actionId, setActionId] = useState(preparedActionId);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const status = resolveStatus(resultStatus, localStatus);
  const payment = confirmedPayment;

  // The chat may be reopened after paying: show what really happened.
  useEffect(() => {
    if (!preparedActionId) return;
    let cancelled = false;
    void getAction(preparedActionId)
      .then((action) => {
        if (cancelled) return;
        if (action.status === 'executed') {
          finishedRef.current = true;
          followedUpRef.current = true;
          setTransactionId(action.transactionId ?? undefined);
          setTxRecordId(action.transactionId);
          setLocalStatus('sent');
        } else if (action.status === 'cancelled') {
          setLocalStatus('cancelled');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [preparedActionId]);

  useEffect(() => {
    const value = payment?.destination.value;
    if (!value) return;
    void findContactByIdentifier(value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [payment?.destination.value]);

  useEffect(() => {
    if (status !== 'sending' || !payment || !actionId) return;

    let cancelled = false;
    const run = async () => {
      const steps = (async () => {
        for (let step = 0; step < 3; step++) {
          if (cancelled) return;
          setSendingStep(step);
          await new Promise((r) => setTimeout(r, SEND_STEP_MS));
        }
      })();
      try {
        const [action] = await Promise.all([executeAction(actionId), steps]);
        if (cancelled || finishedRef.current) return;
        const txId = action.transactionId ?? action.id;
        finishedRef.current = true;
        setTransactionId(txId);
        setTxRecordId(action.transactionId);
        setLocalStatus('sent');
        haptics.success();
        onFinishedRef.current({ preparationId: action.id, transactionId: txId, status: 'sent' });
        if (!followedUpRef.current) {
          followedUpRef.current = true;
          appendAgentFollowUp(aui, paymentSentFollowUp(payment, txId));
        }
      } catch (error) {
        if (cancelled) return;
        haptics.error();
        setLocalStatus('failed');
        appendAgentFollowUp(
          aui,
          `The payment to ${payment.recipientName} didn't go through. ${actionErrorMessage(error)}`,
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actionId, aui, payment, status]);

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
          setBusy(true);
          try {
            // Store the details the user confirmed, checked again by Finora.
            const request = await paymentActionRequest(next);
            const action = actionId
              ? await updateAction(actionId, request)
              : await prepareAction(request);
            setActionId(action.id);
            setConfirmedPayment(next);
            if (action.policy.outcome === 'blocked') {
              appendAgentFollowUp(aui, `I can't send this: ${action.policy.reasons.join(' ')}`);
              return;
            }
            const ok = await requestApproval();
            if (!ok) return;
            setSendingStep(0);
            setLocalStatus('sending');
          } catch (error) {
            haptics.error();
            appendAgentFollowUp(
              aui,
              `I couldn't prepare that payment. ${actionErrorMessage(error)}`,
            );
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => {
          if (status !== 'pending' || busy) return;
          if (actionId) void cancelAction(actionId).catch(() => undefined);
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
    if (requiresPlatformPreparation && !result && status.type === 'running') {
      return <PreparingCard />;
    }

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

    return (
      <PreparePaymentFlow
        seed={seed}
        resultStatus={result?.status}
        actionId={result?.actionId}
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
