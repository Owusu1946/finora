import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { formatCardAmount, remainingLimit, type VirtualCard } from '@/components/cards/types';
import { VirtualCardMiniFace } from '@/components/cards/VirtualCardFace';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
      className={cx(
        'flex-row items-center gap-3 py-3.5 active:opacity-70',
        !isLast && 'border-b border-border',
      )}
    >
      <VirtualCardMiniFace card={card} />
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          className='font-sans-semibold text-base text-foreground'
          numberOfLines={1}
        >
          {card.label}
        </Text>
        <Text
          className='font-sans text-[13px] text-muted-foreground'
          numberOfLines={1}
        >
          •••• {card.last4}
        </Text>
      </View>
      <View className='items-end gap-0.5'>
        <Text className='font-sans-medium text-sm text-foreground'>
          {formatCardAmount(remainingLimit(card), card.currency)}
        </Text>
        <Text
          style={[
            {
              color: card.status === 'active' ? colors.mutedForeground : colors.destructive,
            },
          ]}
          className='font-sans-medium text-[11px] uppercase'
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
