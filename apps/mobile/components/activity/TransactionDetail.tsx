import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { Transaction } from '@/components/activity/types';

import { TransactionTimeline } from '@/components/activity/TransactionTimeline';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

function formatAmount(symbol: string, amount: number): string {
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_COLOR: Record<Transaction['status'], string> = {
  completed: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
};

const SOURCE_LABEL: Record<NonNullable<Transaction['source']>, string> = {
  chat: 'Finora chat',
  mcp: 'AI agent (MCP)',
  manual: 'Manual',
};

export function TransactionDetail({ tx }: { tx: Transaction }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<string | null>(null);

  const sign = tx.direction === 'received' ? '+' : tx.direction === 'sent' ? '−' : '';
  const headline =
    tx.direction === 'swap'
      ? formatAmount(tx.toSymbol ?? '', tx.toAmount ?? 0)
      : `${sign}${formatAmount(tx.symbol, tx.amount)}`;

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    haptics.selection();
    setToast(`${label} copied`);
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <ScrollView
      className='flex-1 bg-background'
      contentContainerClassName='gap-3.5 px-5 pb-10 pt-2'
      showsVerticalScrollIndicator={false}
    >
      <View className='items-center gap-2 py-4'>
        <CurrencyIcon
          currency={tx.direction === 'swap' && tx.toCurrency ? tx.toCurrency : tx.currency}
          size={48}
        />
        <Text className='font-sans-semibold text-[33px] text-foreground'>{headline}</Text>
        <Text className='font-sans-medium text-base text-muted-foreground'>
          {tx.direction === 'swap'
            ? `${formatAmount(tx.symbol, tx.amount)} → ${tx.toCurrency}`
            : tx.counterparty}
        </Text>
        <View className='mt-1 flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5'>
          <View
            className='h-1.5 w-1.5 rounded-full'
            style={{ backgroundColor: STATUS_COLOR[tx.status] }}
          />
          <Text
            className='font-sans-semibold text-[13px] capitalize'
            style={{ color: STATUS_COLOR[tx.status] }}
          >
            {tx.status}
          </Text>
        </View>
      </View>

      <View className='gap-3 rounded-2xl border border-border bg-composer p-4'>
        <Text className='mb-0.5 font-sans-semibold text-base text-foreground'>Status</Text>
        <TransactionTimeline steps={tx.timeline ?? []} />
      </View>

      <View className='gap-3 rounded-2xl border border-border bg-composer p-4'>
        <Text className='mb-0.5 font-sans-semibold text-base text-foreground'>Details</Text>
        <DetailRow
          label='Rail'
          value={tx.rail ?? tx.method}
          colors={colors}
        />
        {tx.wewireId ? (
          <DetailRow
            label='WeWire ID'
            value={tx.wewireId}
            mono
            colors={colors}
            onCopy={() => copy(tx.wewireId!, 'WeWire ID')}
          />
        ) : null}
        {tx.finoraId ? (
          <DetailRow
            label='Finora ID'
            value={tx.finoraId}
            mono
            colors={colors}
            onCopy={() => copy(tx.finoraId!, 'Finora ID')}
          />
        ) : null}
        {tx.destinationValue ? (
          <DetailRow
            label='Destination'
            value={tx.destinationValue}
            mono
            colors={colors}
          />
        ) : null}
        {tx.reference ? (
          <DetailRow
            label='Reference'
            value={tx.reference}
            colors={colors}
          />
        ) : null}
        {tx.fee != null ? (
          <DetailRow
            label='Fee'
            value={formatAmount(
              tx.feeCurrency === tx.currency ? tx.symbol : (tx.feeCurrency ?? ''),
              tx.fee,
            )}
            colors={colors}
          />
        ) : null}
        {tx.source ? (
          <DetailRow
            label='Source'
            value={SOURCE_LABEL[tx.source]}
            colors={colors}
          />
        ) : null}
        <DetailRow
          label='Time'
          value={formatFullTime(tx.timestamp)}
          colors={colors}
        />
      </View>

      {toast ? (
        <View className='mt-2 self-center rounded-full bg-foreground px-3.5 py-2'>
          <Text className='font-sans-semibold text-sm text-background'>{toast}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  mono,
  colors,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  colors: { foreground: string; mutedForeground: string; border: string };
  onCopy?: () => void;
}) {
  return (
    <View className='gap-1 border-t border-border pt-3'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Pressable
        disabled={!onCopy}
        onPress={onCopy}
        className='flex-row items-center gap-2'
      >
        <Text
          selectable
          className={cx(
            'flex-1 font-sans-medium text-base text-foreground',
            mono && 'tabular-nums',
          )}
          numberOfLines={2}
        >
          {value}
        </Text>
        {onCopy ? (
          <Icon
            name='copy'
            size={14}
            color={colors.mutedForeground}
          />
        ) : null}
      </Pressable>
    </View>
  );
}
