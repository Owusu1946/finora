import { makeAssistantToolUI } from '@assistant-ui/react-native';

import { BalancesCard, type BalanceWallet } from '@/components/chat/BalancesCard';

type GetBalancesResult = {
  wallets: BalanceWallet[];
  totalUsd?: number;
};

export const GetBalancesToolUI = makeAssistantToolUI<Record<string, never>, GetBalancesResult>({
  toolName: 'get_balances',
  display: 'standalone',
  render: ({ result, status }) => {
    if (status.type === 'running' && !result?.wallets?.length) {
      return null;
    }
    if (!result?.wallets?.length) return null;
    return (
      <BalancesCard
        wallets={result.wallets}
        totalUsd={result.totalUsd}
      />
    );
  },
});
