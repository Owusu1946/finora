import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import type { VirtualCard } from '@/components/cards/types';
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
      style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
    >
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  );
}

function ListVirtualCardsView({ cards }: { cards: VirtualCard[] }) {
  const { colors } = useTheme();
  const router = useRouter();

  if (cards.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No virtual cards</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Try “Create a virtual card for Netflix with a $50 limit.”
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.listTitle, { color: colors.foreground }]}>
        Virtual cards
      </Text>
      {cards.map((card) => (
        <View
          key={card.id}
          style={styles.cardFrame}
        >
          <VirtualCardFace
            card={card}
            compact
            tilt={false}
            onPress={() => router.push(`/card/${card.id}` as Href)}
          />
          <Text style={[styles.cardCaption, { color: colors.mutedForeground }]}>
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

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    marginVertical: 8,
    width: '100%',
    gap: 14,
  },
  listTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.25,
    paddingHorizontal: 4,
  },
  cardFrame: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 7,
    paddingHorizontal: 2,
  },
  cardCaption: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    paddingHorizontal: 3,
    textTransform: 'capitalize',
  },
  empty: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
  },
  emptySub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
