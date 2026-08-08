import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { PaymentConfirmationStatus } from '@/components/chat/PaymentConfirmationCard';

import { FinancialPlanConfirmationCard } from '@/components/approvals/FinancialPlanConfirmationCard';
import {
  MOCK_BUSINESS_PLAN,
  type FinancialPlanItem,
  type FinancialPlanPayload,
} from '@/components/approvals/types';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type CreateFinancialPlanArgs = {
  intent?: string;
  currency?: string;
  total?: number;
  items?: FinancialPlanItem[];
  planId?: string;
};

type CreateFinancialPlanResult = {
  status?: PaymentConfirmationStatus | 'pending' | 'confirmed';
  planId?: string;
  preparationId?: string;
  transactionId?: string;
};

function asPlan(args: CreateFinancialPlanArgs): FinancialPlanPayload {
  if (args.items && args.items.length > 0) {
    const total =
      typeof args.total === 'number'
        ? args.total
        : args.items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    return {
      planId: args.planId ?? `plan_${Date.now()}`,
      intent: args.intent ?? 'Financial plan',
      currency: args.currency ?? 'USD',
      total,
      items: args.items,
    };
  }
  return {
    ...MOCK_BUSINESS_PLAN,
    intent: args.intent ?? MOCK_BUSINESS_PLAN.intent,
    planId: args.planId ?? MOCK_BUSINESS_PLAN.planId,
  };
}

function PreparingCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
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
  resultStatus: CreateFinancialPlanResult['status'] | undefined,
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

function CreateFinancialPlanConfirm({
  plan,
  resultStatus,
  preparationId,
  resultTransactionId,
  onFinished,
  onCancelled,
}: {
  plan: FinancialPlanPayload;
  resultStatus: CreateFinancialPlanResult['status'] | undefined;
  preparationId: string;
  resultTransactionId?: string;
  onFinished: (payload: {
    preparationId: string;
    planId: string;
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
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const status = resolveStatus(resultStatus, localStatus);

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
      onFinishedRef.current({
        preparationId,
        planId: plan.planId,
        transactionId: txId,
        status: 'sent',
      });

      const recorded = await recordSentPayment({
        payment: {
          amount: plan.total,
          currency: plan.currency,
          recipientName: plan.intent,
          destination: {
            kind: 'bank_account',
            label: 'Financial plan',
            value: `${plan.items.length} line items`,
          },
          reference: plan.planId,
        },
        transactionId: txId,
        source: 'chat',
      });
      if (!cancelled) setTxRecordId(recorded.id);

      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(
          aui,
          `Executed “${plan.intent}” for ${plan.items.length} items (batch ${txId}). Check Approvals history or Activity for the receipt. What else?`,
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, plan, preparationId, resultTransactionId, status]);

  return (
    <>
      <FinancialPlanConfirmationCard
        plan={plan}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        onViewDetails={
          status === 'sent' && (txRecordId || transactionId)
            ? () => {
                router.push(`/transaction/${txRecordId ?? transactionId}` as Href);
              }
            : undefined
        }
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

export const CreateFinancialPlanToolUI = makeAssistantToolUI<
  CreateFinancialPlanArgs,
  CreateFinancialPlanResult
>({
  toolName: 'create_financial_plan',
  display: 'standalone',
  render: ({ args, result, status, addResult }) => {
    const hasArgs =
      args != null &&
      (Boolean(args.intent) || (Array.isArray(args.items) && args.items.length > 0));
    if (status.type === 'running' && !hasArgs) {
      return <PreparingCard />;
    }

    const plan = asPlan(args ?? {});
    const preparationId = result?.preparationId ?? `prep_${plan.planId}`;

    return (
      <CreateFinancialPlanConfirm
        plan={plan}
        resultStatus={result?.status}
        preparationId={preparationId}
        resultTransactionId={result?.transactionId}
        onFinished={({ preparationId: id, planId, transactionId, status: next }) => {
          addResult({ status: next, preparationId: id, planId, transactionId });
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
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
