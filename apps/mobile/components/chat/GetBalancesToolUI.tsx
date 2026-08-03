import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BalancesCard, type BalanceWallet } from '@/components/chat/BalancesCard';
import { useTheme } from '@/hooks/use-theme';

type GetBalancesResult = {
  wallets: BalanceWallet[];
  totalUsd?: number;
};

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

export const GetBalancesToolUI = makeAssistantToolUI<Record<string, never>, GetBalancesResult>({
  toolName: 'get_balances',
  display: 'standalone',
  render: ({ result, status }) => {
    if (status.type === 'running' && !result?.wallets?.length) {
      return <PreparingCard />;
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
