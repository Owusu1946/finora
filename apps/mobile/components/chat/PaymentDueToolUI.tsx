import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';

import {
  PaymentConfirmationCard,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  actionErrorMessage,
  cancelAction,
  executeAction,
  getAction,
  reviewActionPolicy,
} from '@/lib/actions-api';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { toApproval } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';

const STEP_MS = 650;

/**
 * A recurring payment that fell due, posted to the Automations chat with the
 * payment Finora prepared. It pays only when the user approves it here.
 */
function PaymentDueCard({ actionId }: { actionId: string }) {
  const { colors } = useTheme();
  const aui = useAui();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();
  const [payment, setPayment] = useState<PaymentConfirmation | null>(null);
  const [status, setStatus] = useState<PaymentConfirmationStatus>('pending');
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [sendingStep, setSendingStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    void getAction(actionId)
      .then((action) => {
        if (disposed) return;
        setPayment(toApproval(action).payment ?? null);
        setTransactionId(action.transactionId ?? undefined);
        if (action.status === 'executed') setStatus('sent');
        else if (action.status === 'cancelled') setStatus('cancelled');
        else if (action.status === 'failed') setStatus('failed');
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [actionId]);

  if (!payment) {
    return (
      <View
        className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
        style={styles.loading}
      >
        <LoadingIcon color={colors.mutedForeground} />
      </View>
    );
  }

  const approve = async () => {
    if (status !== 'pending' || busy || runningRef.current) return;
    setBusy(true);
    const ok = (await reviewActionPolicy(actionId)) && (await requestApproval());
    setBusy(false);
    if (!ok) return;
    runningRef.current = true;
    setStatus('sending');
    const steps = (async () => {
      for (let step = 0; step < 3; step++) {
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, STEP_MS));
      }
    })();
    try {
      const [action] = await Promise.all([executeAction(actionId), steps]);
      setTransactionId(action.transactionId ?? action.id);
      setStatus('sent');
      haptics.success();
      appendAgentFollowUp(aui, `Paid ${payment.recipientName}. It's in Activity.`);
    } catch (error) {
      haptics.error();
      setStatus('failed');
      appendAgentFollowUp(aui, `That payment didn't go through. ${actionErrorMessage(error)}`);
    } finally {
      runningRef.current = false;
    }
  };

  return (
    <>
      <PaymentConfirmationCard
        payment={payment}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        onConfirm={approve}
        onCancel={() => {
          if (status !== 'pending' || busy) return;
          void cancelAction(actionId)
            .then(() => setStatus('cancelled'))
            .catch(() => undefined);
        }}
        onViewDetails={
          status === 'sent' && transactionId
            ? () => router.push(`/transaction/${transactionId}` as Href)
            : undefined
        }
      />
      {modal}
    </>
  );
}

export const PaymentDueToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  { actionId?: string; recurringId?: string }
>({
  toolName: 'payment_due',
  display: 'standalone',
  render: ({ result }) => (result?.actionId ? <PaymentDueCard actionId={result.actionId} /> : null),
});

const styles = {
  loading: { borderRadius: Radius.card },
};
