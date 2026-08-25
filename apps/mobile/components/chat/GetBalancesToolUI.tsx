import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { BalancesCard, type BalanceWallet } from '@/components/chat/BalancesCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type GetBalancesResult = {
  wallets: BalanceWallet[];
  totalUsd?: number;
};

function PreparingCard() {
  const { colors } = useTheme();
  return (
    <View
      className='my-2 min-h-[72px] items-center justify-center border border-border bg-composer'
      style={styles.preparing}
    >
      <LoadingIcon color={colors.mutedForeground} />
    </View>
  );
}

function EmptyCard() {
  return (
    <View
      className='my-2 gap-1 border border-border bg-composer p-4'
      style={styles.preparing}
    >
      <Text className='font-sans-semibold text-[14px] text-foreground'>Balances unavailable</Text>
      <Text className='font-sans text-[12px] text-muted-foreground'>
        No wallet balances were returned. Try again in a moment.
      </Text>
    </View>
  );
}

export const GetBalancesToolUI = makeAssistantToolUI<Record<string, never>, GetBalancesResult>({
  toolName: 'get_balances',
  display: 'standalone',
  render: ({ result, status }) => {
    if (status.type === 'running' && !result?.wallets?.length) {
      return <PreparingCard />;
    }
    if (!result?.wallets?.length) return <EmptyCard />;
    return (
      <BalancesCard
        wallets={result.wallets}
        totalUsd={result.totalUsd}
      />
    );
  },
});

const styles = {
  preparing: { borderRadius: Radius.card },
};
