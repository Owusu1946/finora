import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCardAmount, remainingLimit, type VirtualCard } from '@/components/cards/types';
import { VirtualCardMiniFace } from '@/components/cards/VirtualCardFace';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export const VirtualCardListItem = memo(function VirtualCardListItem({
  card,
  isLast,
  onPress,
}: {
  card: VirtualCard;
  isLast?: boolean;
  onPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const statusLabel =
    card.status === 'cancelled' ? 'Cancelled' : card.status === 'frozen' ? 'Frozen' : 'Active';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress(card.id);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <VirtualCardMiniFace card={card} />
      <View style={styles.copy}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {card.label}
        </Text>
        <Text
          style={[styles.sub, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          •••• {card.last4}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.foreground }]}>
          {formatCardAmount(remainingLimit(card), card.currency)}
        </Text>
        <Text
          style={[
            styles.status,
            {
              color: card.status === 'active' ? colors.mutedForeground : colors.destructive,
            },
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      <Icon
        name='chevron-right'
        size={16}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  status: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
