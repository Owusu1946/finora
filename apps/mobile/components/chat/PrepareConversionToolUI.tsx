import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  ConversionCard,
  type ConversionQuote,
  type ConversionStatus,
} from '@/components/chat/ConversionCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { actionErrorMessage, cancelAction, executeAction, getAction } from '@/lib/actions-api';
import { appendAgentFollowUp, conversionDoneFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';

type PrepareConversionArgs = {
  from?: string;
  to?: string;
  amount?: number;
  fromCurrency?: string;
  toCurrency?: string;
  fromAmount?: number;
  toAmount?: number;
  rate?: number;
  fee?: number;
  feeCurrency?: string;
};

type PrepareConversionResult = {
  status?: ConversionStatus | 'pending' | 'confirmed';
  /** The prepared conversion on the Finora API; it executes only after the passcode. */
  actionId?: string;
  conversionId?: string;
  fromCurrency?: string;
  toCurrency?: string;
  fromAmount?: number;
  toAmount?: number;
  rate?: number;
  fee?: number;
  feeCurrency?: string;
};

function asQuote(args: PrepareConversionArgs, result?: PrepareConversionResult) {
  const fromCurrency = result?.fromCurrency ?? args.fromCurrency ?? args.from;
  const toCurrency = result?.toCurrency ?? args.toCurrency ?? args.to;
  const fromAmount = result?.fromAmount ?? args.fromAmount ?? args.amount;
  const toAmount = result?.toAmount ?? args.toAmount;
  const rate = result?.rate ?? args.rate;
  if (
    !fromCurrency ||
    !toCurrency ||
    fromAmount === undefined ||
    toAmount === undefined ||
    rate === undefined ||
    fromAmount <= 0 ||
    toAmount <= 0 ||
    rate <= 0
  ) {
    return null;
  }
  return {
    fromCurrency,
    toCurrency,
    fromAmount,
    toAmount,
    rate,
    fee: result?.fee ?? args.fee,
    feeCurrency: result?.feeCurrency ?? args.feeCurrency,
  };
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

const CONVERT_STEP_MS = 600;

function resolveStatus(
  resultStatus: PrepareConversionResult['status'] | undefined,
  local: ConversionStatus | null,
): ConversionStatus {
  if (local) return local;
  if (resultStatus === 'converted') return 'converted';
  if (resultStatus === 'converting') return 'converting';
  if (resultStatus === 'cancelled') return 'cancelled';
  if (resultStatus === 'failed') return 'failed';
  if (resultStatus === 'confirmed') return 'converting';
  return 'pending';
}

function PrepareConversionConfirm({
  quote,
  actionId,
  resultStatus,
  resultConversionId,
  onFinished,
  onCancelled,
}: {
  quote: ConversionQuote;
  actionId: string;
  resultStatus: PrepareConversionResult['status'] | undefined;
  resultConversionId?: string;
  onFinished: (payload: { conversionId: string; status: 'converted' }) => void;
  onCancelled: () => void;
}) {
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<ConversionStatus | null>(null);
  const [convertingStep, setConvertingStep] = useState(0);
  const [conversionId, setConversionId] = useState(resultConversionId);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const status = resolveStatus(resultStatus, localStatus);

  // The chat may be reopened after converting: show what really happened.
  useEffect(() => {
    let cancelled = false;
    void getAction(actionId)
      .then((action) => {
        if (cancelled) return;
        if (action.status === 'executed') {
          finishedRef.current = true;
          followedUpRef.current = true;
          setConversionId(action.transactionId ?? action.id);
          setLocalStatus('converted');
        } else if (action.status === 'cancelled') {
          setLocalStatus('cancelled');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  useEffect(() => {
    if (status !== 'converting') return;
    let cancelled = false;
    const run = async () => {
      const steps = (async () => {
        for (let step = 0; step < 3; step++) {
          if (cancelled) return;
          setConvertingStep(step);
          await new Promise((r) => setTimeout(r, CONVERT_STEP_MS));
        }
      })();
      try {
        const [action] = await Promise.all([executeAction(actionId), steps]);
        if (cancelled || finishedRef.current) return;
        const id = action.transactionId ?? action.id;
        finishedRef.current = true;
        setConversionId(id);
        setLocalStatus('converted');
        haptics.success();
        onFinishedRef.current({ conversionId: id, status: 'converted' });
        if (!followedUpRef.current) {
          followedUpRef.current = true;
          appendAgentFollowUp(aui, conversionDoneFollowUp(quote, id));
        }
      } catch (error) {
        if (cancelled) return;
        haptics.error();
        setLocalStatus('failed');
        appendAgentFollowUp(aui, `The conversion didn't go through. ${actionErrorMessage(error)}`);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actionId, aui, quote, status]);

  return (
    <>
      <ConversionCard
        quote={quote}
        status={status}
        loading={busy}
        convertingStep={convertingStep}
        conversionId={conversionId}
        onConfirm={async () => {
          if (status !== 'pending' || busy) return;
          setBusy(true);
          const ok = await requestApproval();
          setBusy(false);
          if (!ok) return;
          setConvertingStep(0);
          setLocalStatus('converting');
        }}
        onCancel={() => {
          if (status !== 'pending' || busy) return;
          void cancelAction(actionId).catch(() => undefined);
          onCancelled();
        }}
      />
      {modal}
    </>
  );
}

export const PrepareConversionToolUI = makeAssistantToolUI<
  PrepareConversionArgs,
  PrepareConversionResult
>({
  toolName: 'prepare_conversion',
  display: 'standalone',
  render: ({ args, result, status, addResult }) => {
    const quote = asQuote(args ?? {}, result);
    if (!quote || !result?.actionId) return status.type === 'running' ? <PreparingCard /> : null;

    return (
      <PrepareConversionConfirm
        quote={quote}
        actionId={result.actionId}
        resultStatus={result?.status}
        resultConversionId={result?.conversionId}
        onFinished={({ conversionId, status: next }) => {
          addResult({ status: next, conversionId });
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
