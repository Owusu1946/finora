import type { CardTransaction } from '@finora/shared';

import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatCardAmount, type VirtualCard } from '@/components/cards/types';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { listCardTransactions, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

const STATE_LABEL: Partial<Record<CardTransaction['state'], string>> = {
  pending: 'Pending',
  declined: 'Declined',
  reversed: 'Reversed',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TransactionRow({
  transaction,
  isLast,
}: {
  transaction: CardTransaction;
  isLast: boolean;
}) {
  const charged = transaction.state === 'pending' || transaction.state === 'completed';
  const refund = transaction.kind === 'refund';
  const status = refund && charged ? 'Refund' : STATE_LABEL[transaction.state];
  const meta = [formatWhen(transaction.createdAt), transaction.location, status]
    .filter(Boolean)
    .join(' · ');
  const amount = formatCardAmount(Math.abs(transaction.amount), 'USD');
  const foreign = transaction.merchantCurrency !== 'USD';

  return (
    <View className={cx('flex-row items-center gap-3 py-3', !isLast && 'border-b border-border')}>
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          numberOfLines={1}
          className='font-sans-semibold text-[15px] text-foreground'
        >
          {transaction.merchant}
        </Text>
        <Text
          numberOfLines={1}
          className='font-sans text-[13px] text-muted-foreground'
        >
          {meta}
        </Text>
      </View>
      <View className='items-end gap-0.5'>
        {charged ? (
          <Text
            selectable
            className='font-sans-semibold text-[15px] tabular-nums text-foreground'
          >
            {refund ? `+${amount}` : `−${amount}`}
          </Text>
        ) : (
          <Text
            selectable
            className='font-sans-medium text-[15px] tabular-nums text-muted-foreground line-through'
          >
            {amount}
          </Text>
        )}
        {!charged ? (
          <Text className='font-sans text-[12px] text-muted-foreground'>Not charged</Text>
        ) : foreign ? (
          <Text className='font-sans text-[12px] tabular-nums text-muted-foreground'>
            {formatCardAmount(Math.abs(transaction.merchantAmount), transaction.merchantCurrency)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RowsSkeleton() {
  return (
    <View accessibilityLabel='Loading purchases'>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          className={cx('flex-row items-center gap-3 py-3', index < 2 && 'border-b border-border')}
        >
          <View className='flex-1 gap-1.5'>
            <View className='h-4 w-32 rounded-full bg-muted' />
            <View className='h-3 w-24 rounded-full bg-muted' />
          </View>
          <View className='h-4 w-14 rounded-full bg-muted' />
        </View>
      ))}
    </View>
  );
}

/**
 * Purchases made with a card and how much each took off its balance, plus a
 * "Deducted $X of $Y" summary. Refreshes when the card changes.
 */
export function CardTransactions({ card }: { card: VirtualCard }) {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listCardTransactions(card.id);
    setTransactions(result.transactions);
    setError(result.error);
    setLoading(false);
  }, [card.id]);

  useEffect(() => {
    void load();
    return subscribeVirtualCards(() => void load());
  }, [load]);

  return (
    <View
      className='gap-1 rounded-[26px] border border-border bg-composer px-3.5 pb-1.5 pt-3.5'
      style={{ borderCurve: 'continuous' }}
    >
      <View className='flex-row items-baseline justify-between'>
        <Text className='font-sans-semibold text-[17px] text-foreground'>Purchases</Text>
        <Text className='font-sans-medium text-[13px] tabular-nums text-muted-foreground'>
          Deducted {formatCardAmount(card.spent, 'USD')} of{' '}
          {formatCardAmount(card.spendLimit, 'USD')}
        </Text>
      </View>

      {loading ? (
        <RowsSkeleton />
      ) : error && transactions.length === 0 ? (
        <View className='items-start gap-2 py-3'>
          <Text className='font-sans text-sm leading-5 text-muted-foreground'>{error}</Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              setLoading(true);
              void load();
            }}
            className='rounded-full bg-muted px-4 py-2'
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className='font-sans-semibold text-sm text-foreground'>Try again</Text>
          </Pressable>
        </View>
      ) : transactions.length === 0 ? (
        <Text className='py-3 font-sans text-sm leading-5 text-muted-foreground'>
          No purchases yet. Anything paid with this card shows up here.
        </Text>
      ) : (
        transactions.map((transaction, index) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            isLast={index === transactions.length - 1}
          />
        ))
      )}
    </View>
  );
}
