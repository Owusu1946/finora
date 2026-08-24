import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import type { FundingSource } from '@/lib/funding-methods';

import { FundAccountWizard, type FundAccountSeed } from '@/components/chat/FundAccountWizard';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { recordReceivedFunding } from '@/lib/transactions-storage';

type FundAccountArgs = FundAccountSeed;

type FundAccountResult = {
  status?: 'credited' | 'cancelled';
  transactionId?: string;
  amount?: number;
  currency?: string;
  source?: FundingSource;
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

function FundAccountFlow({
  seed,
  onFinished,
  onCancelled,
}: {
  seed: FundAccountSeed;
  onFinished: (payload: FundAccountResult & { status: 'credited' }) => void;
  onCancelled: () => void;
}) {
  const aui = useAui();
  const followedUpRef = useRef(false);

  return (
    <FundAccountWizard
      seed={seed}
      onCancelled={onCancelled}
      onCredited={async (payload) => {
        await recordReceivedFunding({
          amount: payload.amount,
          currency: payload.currency,
          method: payload.method.title,
          counterparty: 'Inbound funding',
          transactionId: payload.transactionId,
          reference: `Fund via ${payload.source}`,
        });
        onFinished({
          status: 'credited',
          transactionId: payload.transactionId,
          amount: payload.amount,
          currency: payload.currency,
          source: payload.source,
        });
        if (!followedUpRef.current) {
          followedUpRef.current = true;
          appendAgentFollowUp(
            aui,
            `${formatPaymentAmount(payload.amount, payload.currency)} is in your ${payload.currency} wallet. Want to send some, convert, or check balances?`,
          );
        }
      }}
    />
  );
}

export const FundAccountToolUI = makeAssistantToolUI<FundAccountArgs, FundAccountResult>({
  toolName: 'fund_account',
  display: 'standalone',
  render: ({ args, status, addResult }) => {
    if (status.type === 'running' && args == null) {
      return <PreparingCard />;
    }

    return (
      <FundAccountFlow
        seed={args ?? {}}
        onFinished={(payload) => {
          addResult(payload);
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
