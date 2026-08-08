import { StyleSheet, Text, View, Pressable } from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
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

export function ActivityListItem({ tx, isLast, onPress }: ActivityListItemProps) {
  const { colors } = useTheme();

  const sign = tx.direction === 'received' ? '+' : '-';
  const amountColor =
    tx.status === 'failed'
      ? colors.mutedForeground
      : tx.direction === 'received'
        ? '#10B981'
        : colors.foreground;

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(tx);
      }}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {/* Left: icon + details */}
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <CurrencyIcon
            currency={tx.currency}
            size={36}
          />
          <View style={[styles.directionBadge, { backgroundColor: colors.background }]}>
            <Icon
              name={DIRECTION_ICON[tx.direction]}
              size={10}
              color={colors.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.meta}>
          <Text
            style={[styles.counterparty, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {tx.counterparty}
          </Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>
            {tx.method} • {formatTime(tx.timestamp)}
          </Text>
        </View>
      </View>

      {/* Right: amount + status */}
      <View style={styles.right}>
        {tx.direction === 'swap' && tx.toCurrency ? (
          <>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatAmount(tx.toSymbol ?? '', tx.toAmount ?? 0)}
            </Text>
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>
              {formatAmount(tx.symbol, tx.amount)} → {tx.toCurrency}
            </Text>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.amount,
                { color: amountColor },
                tx.status === 'failed' && styles.strikethrough,
              ]}
            >
              {sign}
              {formatAmount(tx.symbol, tx.amount)}
            </Text>
            {tx.status !== 'completed' && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[tx.status] }]} />
                <Text style={[styles.statusLabel, { color: STATUS_COLOR[tx.status] }]}>
                  {tx.status}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  iconWrap: {
    position: 'relative',
  },
  directionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    gap: 2,
    flexShrink: 1,
  },
  counterparty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '400',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
