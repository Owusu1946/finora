import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { formatCardAmount } from '@/components/cards/types';
import type { VirtualCard } from '@/components/cards/types';
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
      style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
    >
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  );
}

function MissingCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Card not found</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        Try “Show my cards” or create a new virtual card.
      </Text>
    </View>
  );
}

function CardPreview({ card }: { card: VirtualCard }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.preview}>
      <View style={styles.cardFrame}>
        <VirtualCardFace
          card={card}
          compact
          tilt={false}
        />
      </View>
      <View style={styles.previewFooter}>
        <View style={styles.previewCopy}>
          <Text style={[styles.previewTitle, { color: colors.foreground }]}>
            {card.label} · {card.status}
          </Text>
          <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
            {formatCardAmount(card.spent, card.currency)} spent of{' '}
            {formatCardAmount(card.spendLimit, card.currency)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.push(`/card/${card.id}` as Href);
          }}
          style={({ pressed }) => [
            styles.openButton,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.openButtonText, { color: colors.foreground }]}>Open</Text>
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
      <View style={styles.wrap}>
        <CardPreview card={result.card} />
      </View>
    );
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
  wrap: {
    marginVertical: 8,
  },
  preview: {
    width: '100%',
    gap: 10,
  },
  cardFrame: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  previewSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  openButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openButtonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
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
