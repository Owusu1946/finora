import { memo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';

import type { RecurringPayment } from '@/components/recurring/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const STATUS_COLOR: Record<RecurringPayment['status'], string> = {
  active: '#10B981',
  paused: '#F59E0B',
  cancelled: '#EF4444',
};

const FREQ: Record<RecurringPayment['frequency'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export const RecurringListItem = memo(function RecurringListItem({
  item,
  isLast,
  onPause,
  onResume,
}: {
  item: RecurringPayment;
  isLast: boolean;
  onPause?: (item: RecurringPayment) => void;
  onResume?: (item: RecurringPayment) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Icon
          name='reload'
          size={16}
          color={colors.foreground}
        />
      </View>
      <View style={styles.meta}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.recipientName}
        </Text>
        <Text
          style={[styles.detail, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {FREQ[item.frequency]} · next{' '}
          {new Date(item.nextRunAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.foreground }]}>
          {formatPaymentAmount(item.amount, item.currency)}
        </Text>
        {item.status === 'active' ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              onPause?.(item);
            }}
          >
            <Text style={[styles.action, { color: colors.mutedForeground }]}>Pause</Text>
          </Pressable>
        ) : item.status === 'paused' ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              onResume?.(item);
            }}
          >
            <Text style={[styles.action, { color: '#10B981' }]}>Resume</Text>
          </Pressable>
        ) : (
          <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  action: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
