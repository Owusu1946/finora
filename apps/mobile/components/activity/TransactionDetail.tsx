import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Transaction } from '@/components/activity/types';

import { TransactionTimeline } from '@/components/activity/TransactionTimeline';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <CurrencyIcon
          currency={tx.direction === 'swap' && tx.toCurrency ? tx.toCurrency : tx.currency}
          size={48}
        />
        <Text style={[styles.amount, { color: colors.foreground }]}>{headline}</Text>
        <Text style={[styles.counterparty, { color: colors.mutedForeground }]}>
          {tx.direction === 'swap'
            ? `${formatAmount(tx.symbol, tx.amount)} → ${tx.toCurrency}`
            : tx.counterparty}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: colors.muted }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[tx.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[tx.status] }]}>{tx.status}</Text>
        </View>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Status</Text>
        <TransactionTimeline steps={tx.timeline ?? []} />
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
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
        <View style={[styles.toast, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.toastText, { color: colors.background }]}>{toast}</Text>
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
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Pressable
        disabled={!onCopy}
        onPress={onCopy}
        style={styles.detailValueWrap}
      >
        <Text
          selectable
          style={[styles.detailValue, mono && styles.mono, { color: colors.foreground }]}
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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 33,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  counterparty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  detailRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 4,
  },
  detailLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  mono: {
    fontVariant: ['tabular-nums'],
  },
  toast: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  toastText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
});
