import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { FinancialPlanItem, FinancialPlanPayload } from '@/components/approvals/types';
import type { PaymentConfirmationStatus } from '@/components/chat/PaymentConfirmationCard';

import { FinancialPlanConfirmationCard } from '@/components/approvals/FinancialPlanConfirmationCard';
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
} from '@/lib/actions-api';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';

type FinancialPlanItemInput = Omit<FinancialPlanItem, 'amount' | 'currency' | 'label'> & {
  amount?: number | { amount: number; currency: string };
  currency?: string;
  label?: string;
};

type FinancialPlanInput = {
  intent?: string;
  currency?: string;
  total?: number;
  items?: FinancialPlanItemInput[];
  planId?: string;
};

type CreateFinancialPlanArgs = FinancialPlanInput;

type CreateFinancialPlanResult = {
  status?: PaymentConfirmationStatus | 'pending' | 'confirmed';
  /** The prepared plan on the Finora API; it executes only after the passcode. */
  actionId?: string;
  planId?: string;
  preparationId?: string;
  transactionId?: string;
  plan?: Omit<FinancialPlanInput, 'planId'> & { id?: string };
};

function asPlan(
  args: CreateFinancialPlanArgs,
  result?: CreateFinancialPlanResult,
): FinancialPlanPayload | null {
  const resultPlan = result?.plan;
  const source = {
    ...args,
    ...resultPlan,
    planId: result?.planId ?? resultPlan?.id ?? args.planId,
    items: resultPlan?.items ?? args.items,
  };

  if (source.items && source.items.length > 0) {
    const items: FinancialPlanItem[] = source.items.map((item) => ({
      ...item,
      label: item.label ?? item.kind,
      amount: typeof item.amount === 'object' ? item.amount.amount : (item.amount ?? 0),
      currency:
        typeof item.amount === 'object'
          ? item.amount.currency
          : (item.currency ?? source.currency ?? 'USD'),
    }));
    const total =
      typeof source.total === 'number'
        ? source.total
        : items.reduce((sum, item) => sum + item.amount, 0);
    return {
      planId: source.planId ?? `plan_${Date.now()}`,
      intent: source.intent ?? 'Financial plan',
      currency: source.currency ?? 'USD',
      total,
      items,
    };
  }
  return null;
}

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
  actionId: preparedActionId,
  resultStatus,
  preparationId,
  resultTransactionId,
  onFinished,
  onCancelled,
}: {
  plan: FinancialPlanPayload;
  actionId?: string;
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

  // The chat may be reopened after approving: show what really happened.
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
    if (status !== 'sending') return;

    let cancelled = false;
    const run = async () => {
      const steps = (async () => {
        for (let step = 0; step < 3; step++) {
          if (cancelled) return;
          setSendingStep(step);
          await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
        }
      })();
      let action;
      try {
        const id =
          preparedActionId ??
          (
            await prepareAction({
              kind: 'plan',
              title: plan.intent.slice(0, 120),
              currency: plan.currency,
              items: plan.items.map((item) => ({
                title: item.label.slice(0, 120),
                amount: item.amount,
                category: item.kind,
              })),
            })
          ).id;
        [action] = await Promise.all([executeAction(id), steps]);
      } catch (error) {
        if (cancelled) return;
        haptics.error();
        setLocalStatus('failed');
        appendAgentFollowUp(
          aui,
          `“${plan.intent}” didn't go through. ${actionErrorMessage(error)}`,
        );
        return;
      }
      if (cancelled || finishedRef.current) return;
      const txId = action.transactionId ?? action.id;
      finishedRef.current = true;
      setTransactionId(txId);
      setTxRecordId(action.transactionId);
      setLocalStatus('sent');
      haptics.success();
      onFinishedRef.current({
        preparationId,
        planId: plan.planId,
        transactionId: txId,
        status: 'sent',
      });

      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(
          aui,
          `Done: “${plan.intent}” for ${plan.items.length} items (ref ${txId}). It's in Activity. What else?`,
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, plan, preparationId, preparedActionId, status]);

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
          if (preparedActionId) void cancelAction(preparedActionId).catch(() => undefined);
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
    const requiresPlatformPreparation = args?.items?.some(
      (item) => typeof item.amount === 'object' && item.amount !== null,
    );
    if (requiresPlatformPreparation && !result && status.type === 'running') {
      return <PreparingCard />;
    }

    const hasArgs =
      args != null &&
      (Boolean(args.intent) || (Array.isArray(args.items) && args.items.length > 0));
    if (status.type === 'running' && !hasArgs) {
      return <PreparingCard />;
    }

    const plan = asPlan(args ?? {}, result);
    if (!plan) return null;
    const preparationId = result?.preparationId ?? result?.actionId ?? `prep_${plan.planId}`;

    return (
      <CreateFinancialPlanConfirm
        plan={plan}
        actionId={result?.actionId}
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

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
};
