import { memo } from 'react';
import { View, Pressable } from 'react-native';

import type { RecurringPayment } from '@/components/recurring/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
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
  return (
    <View className={cx('flex-row items-center gap-3 py-3.5', !isLast && 'border-b border-border')}>
      <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
        <Icon
          name='reload'
          size={16}
          color='#18181B'
        />
      </View>
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          className='font-sans-semibold text-base text-foreground'
          numberOfLines={1}
        >
          {item.recipientName}
        </Text>
        <Text
          className='font-sans text-[13px] text-muted-foreground'
          numberOfLines={1}
        >
          {FREQ[item.frequency]} · next{' '}
          {new Date(item.nextRunAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
      <View className='items-end gap-1'>
        <Text className='font-sans-semibold text-base text-foreground'>
          {formatPaymentAmount(item.amount, item.currency)}
        </Text>
        {item.status === 'active' ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              onPause?.(item);
            }}
          >
            <Text className='font-sans-semibold text-[13px] text-muted-foreground'>Pause</Text>
          </Pressable>
        ) : item.status === 'paused' ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              onResume?.(item);
            }}
          >
            <Text className='font-sans-semibold text-[13px] text-[#10B981]'>Resume</Text>
          </Pressable>
        ) : (
          <Text
            className='font-sans-semibold text-xs capitalize'
            style={{ color: STATUS_COLOR[item.status] }}
          >
            {item.status}
          </Text>
        )}
      </View>
    </View>
  );
});
