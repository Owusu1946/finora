import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  ReceiveMoneyCard,
  type ReceiveMethod,
} from '@/components/chat/ReceiveMoneyCard';
import { useTheme } from '@/hooks/use-theme';

type ListReceiveArgs = {
  currency?: string;
  prefer?: 'virtual_account' | 'mobile_money' | 'crypto';
};

type ListReceiveResult = {
  methods: ReceiveMethod[];
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

export const ListReceiveMethodsToolUI = makeAssistantToolUI<
  ListReceiveArgs,
  ListReceiveResult
>({
  toolName: 'list_receive_methods',
  display: 'standalone',
  render: ({ args, result, status }) => {
    if (status.type === 'running' && !result?.methods?.length) {
      return <PreparingCard />;
    }

    const methods = result?.methods ?? [];
    if (!methods.length) return null;

    const preferred =
      args?.prefer != null
        ? methods.find((m) => m.kind === args.prefer)?.id
        : args?.currency
          ? methods.find((m) => m.currency.toUpperCase() === args.currency?.toUpperCase())?.id
          : undefined;

    return (
      <ReceiveMoneyCard
        methods={methods}
        initialMethodId={preferred}
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
