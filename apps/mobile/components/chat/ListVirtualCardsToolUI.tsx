import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListVirtualCardsArgs = {
  status?: 'active' | 'frozen' | 'all';
};

type ListVirtualCardsResult = {
  cards?: VirtualCard[];
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

function ListVirtualCardsView({ cards }: { cards: VirtualCard[] }) {
  const router = useRouter();

  if (cards.length === 0) {
    return (
      <View
        className='my-2 border p-4 gap-1.5 border-border bg-composer'
        style={[styles.empty]}
      >
        <Text className='font-sans-semibold text-[16px] text-foreground'>No virtual cards</Text>
        <Text className='font-sans text-[14px] leading-[20px] text-muted-foreground'>
          Try “Create a virtual card for Netflix with a $50 limit.”
        </Text>
      </View>
    );
  }

  return (
    <View className='my-2 w-[100%] gap-3.5'>
      <Text className='font-sans-semibold text-[17px] tracking-[-0.25px] px-1 text-foreground'>
        Virtual cards
      </Text>
      {cards.map((card) => (
        <View
          key={card.id}
          className='w-[100%] max-w-[420px] self-center gap-[7px] px-0.5'
        >
          <VirtualCardFace
            card={card}
            compact
            tilt={false}
            onPress={() => router.push(`/card/${card.id}` as Href)}
          />
          <Text className='font-sans text-[13px] px-[3px] capitalize text-muted-foreground'>
            {card.label} · •••• {card.last4} · {card.status}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const ListVirtualCardsToolUI = makeAssistantToolUI<
  ListVirtualCardsArgs,
  ListVirtualCardsResult
>({
  toolName: 'list_virtual_cards',
  display: 'standalone',
  render: ({ result, status }) => {
    if (status.type === 'running' && result == null) {
      return <PreparingCard />;
    }
    return <ListVirtualCardsView cards={result?.cards ?? []} />;
  },
});

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
  empty: {
    borderRadius: Radius.card,
  },
};
