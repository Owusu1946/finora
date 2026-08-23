import { memo } from 'react';
import { View, Pressable } from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

import type { Transaction } from './types';

interface ActivityListItemProps {
  tx: Transaction;
  isLast: boolean;
  onPress?: (tx: Transaction) => void;
}

const DIRECTION_ICON: Record<Transaction['direction'], IconName> = {
  sent: 'arrow-up',
  received: 'arrow-down-left',
  swap: 'swap',
};

const STATUS_COLOR: Record<Transaction['status'], string> = {
  completed: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function formatAmount(symbol: string, amount: number): string {
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const ActivityListItem = memo(function ActivityListItem({
  tx,
  isLast,
  onPress,
}: ActivityListItemProps) {
  const sign = tx.direction === 'received' ? '+' : '-';
  const amountColor =
    tx.status === 'failed'
      ? 'text-muted-foreground'
      : tx.direction === 'received'
        ? 'text-[#10B981]'
        : 'text-foreground';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(tx);
      }}
      className={cx(
        'flex-row items-center justify-between py-3.5',
        !isLast && 'border-b border-border active:opacity-70',
      )}
    >
      {/* Left: icon + details */}
      <View className='flex-row shrink items-center gap-3'>
        <View className='relative'>
          <CurrencyIcon
            currency={tx.currency}
            size={36}
          />
          <View className='absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-background'>
            <Icon
              name={DIRECTION_ICON[tx.direction]}
              size={10}
              color='#71717A'
            />
          </View>
        </View>

        <View className='shrink gap-0.5'>
          <Text
            className='font-sans-semibold text-base text-foreground'
            numberOfLines={1}
          >
            {tx.counterparty}
          </Text>
          <Text className='font-sans text-[13px] text-muted-foreground'>
            {tx.method} • {formatTime(tx.timestamp)}
          </Text>
        </View>
      </View>

      {/* Right: amount + status */}
      <View className='items-end gap-0.5'>
        {tx.direction === 'swap' && tx.toCurrency ? (
          <>
            <Text className='font-sans-semibold text-base text-foreground'>
              {formatAmount(tx.toSymbol ?? '', tx.toAmount ?? 0)}
            </Text>
            <Text className='font-sans text-[13px] text-muted-foreground'>
              {formatAmount(tx.symbol, tx.amount)} → {tx.toCurrency}
            </Text>
          </>
        ) : (
          <>
            <Text
              className={cx(
                'font-sans-semibold text-base',
                amountColor,
                tx.status === 'failed' && 'line-through',
              )}
            >
              {sign}
              {formatAmount(tx.symbol, tx.amount)}
            </Text>
            {tx.status !== 'completed' && (
              <View className='flex-row items-center gap-1'>
                <View
                  className='h-[5px] w-[5px] rounded-full'
                  style={{ backgroundColor: STATUS_COLOR[tx.status] }}
                />
                <Text
                  className='font-sans-medium text-xs capitalize'
                  style={{ color: STATUS_COLOR[tx.status] }}
                >
                  {tx.status}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
});
