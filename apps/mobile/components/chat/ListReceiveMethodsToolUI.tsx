import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { ReceiveMoneyCard, type ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
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
      className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
      style={[styles.preparing]}
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
      <Text className='font-sans-semibold text-[14px] text-foreground'>
        Receive methods unavailable
      </Text>
      <Text className='font-sans text-[12px] text-muted-foreground'>
        No supported receiving details were returned for this request.
      </Text>
    </View>
  );
}

export const ListReceiveMethodsToolUI = makeAssistantToolUI<ListReceiveArgs, ListReceiveResult>({
  toolName: 'list_receive_methods',
  display: 'standalone',
  render: ({ args, result, status }) => {
    if (status.type === 'running' && !result?.methods?.length) {
      return <PreparingCard />;
    }

    const methods = result?.methods ?? [];
    if (!methods.length) return <EmptyCard />;

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

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
};
