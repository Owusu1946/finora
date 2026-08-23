import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { formatCardAmount } from '@/components/cards/types';
import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type GetVirtualCardArgs = {
  cardId?: string;
  label?: string;
};

type GetVirtualCardResult = {
  card?: VirtualCard | null;
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

function MissingCard() {
  const { colors } = useTheme();
  return (
    <View
      className='my-2 border p-4 gap-1.5 border-border bg-composer'
      style={[styles.empty]}
    >
      <Text className='font-sans-semibold text-[16px] text-foreground'>Card not found</Text>
      <Text className='font-sans text-[14px] leading-[20px] text-muted-foreground'>
        Try “Show my cards” or create a new virtual card.
      </Text>
    </View>
  );
}

function CardPreview({ card }: { card: VirtualCard }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View className='w-[100%] gap-2.5'>
      <View className='w-[100%] max-w-[420px] self-center px-0.5 py-1.5'>
        <VirtualCardFace
          card={card}
          compact
          tilt={false}
        />
      </View>
      <View className='flex-row items-center gap-3 px-1'>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[15px] capitalize text-foreground'>
            {card.label} · {card.status}
          </Text>
          <Text className='font-sans text-[13px] text-muted-foreground'>
            {formatCardAmount(card.spent, card.currency)} spent of{' '}
            {formatCardAmount(card.spendLimit, card.currency)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.push(`/card/${card.id}` as Href);
          }}
          className='border px-3.5 py-2'
          style={({ pressed }) => [
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text className='font-sans-semibold text-[13px] text-foreground'>Open</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const GetVirtualCardToolUI = makeAssistantToolUI<GetVirtualCardArgs, GetVirtualCardResult>({
  toolName: 'get_virtual_card',
  display: 'standalone',
  render: ({ result, status }) => {
    if (status.type === 'running' && result == null) {
      return <PreparingCard />;
    }

    if (!result?.card) {
      return <MissingCard />;
    }

    return (
      <View className='my-2'>
        <CardPreview card={result.card} />
      </View>
    );
  },
});

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
  openButton: {
    borderRadius: Radius.pill,
  },
  empty: {
    borderRadius: Radius.card,
  },
};
