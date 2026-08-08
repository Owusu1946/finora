import { useAui } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { sendChatPrompt } from '@/lib/send-chat-prompt';

export type BalanceWallet = {
  id: string;
  currency: string;
  name: string;
  balance: number;
  usdEquivalent: number;
  symbol: string;
};

type BalancesCardProps = {
  wallets: BalanceWallet[];
  totalUsd?: number;
};

function maskAmount(symbol: string, amount: number, hidden: boolean) {
  if (hidden) return `${symbol}••••••`;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function receivePrompt(currency: string) {
  if (currency === 'USDT' || currency === 'USDC') return `Show my ${currency} address`;
  if (currency === 'GHS') return 'Receive money via MoMo';
  return `Receive money in ${currency}`;
}

export function BalancesCard({ wallets, totalUsd }: BalancesCardProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const [hidden, setHidden] = useState(false);

  const total =
    totalUsd ??
    wallets.reduce((sum, w) => sum + (Number.isFinite(w.usdEquivalent) ? w.usdEquivalent : 0), 0);

  const promptSend = (currency: string) => {
    haptics.selection();
    sendChatPrompt(aui, `Send money from my ${currency} wallet`);
  };

  const promptReceive = (currency: string) => {
    haptics.selection();
    sendChatPrompt(aui, receivePrompt(currency));
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Balances</Text>
          <Text style={[styles.total, { color: colors.foreground }]}>
            {hidden
              ? '$••••••'
              : `$${total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </Text>
          <Text style={[styles.totalHint, { color: colors.mutedForeground }]}>
            Total across wallets (USD)
          </Text>
        </View>
        <Pressable
          accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'}
          hitSlop={10}
          onPress={() => {
            haptics.selection();
            setHidden((v) => !v);
          }}
          style={({ pressed }) => [
            styles.eyeBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon
            name={hidden ? 'eye-off' : 'eye'}
            size={18}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <View style={styles.list}>
        {wallets.map((wallet) => (
          <View
            key={wallet.id}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <View style={styles.rowMain}>
              <CurrencyIcon
                currency={wallet.currency}
                size={34}
              />
              <View style={styles.rowMeta}>
                <Text style={[styles.currency, { color: colors.foreground }]}>
                  {wallet.currency}
                </Text>
                <Text style={[styles.name, { color: colors.mutedForeground }]}>{wallet.name}</Text>
              </View>
              <View style={styles.rowAmounts}>
                <Text style={[styles.balance, { color: colors.foreground }]}>
                  {maskAmount(wallet.symbol, wallet.balance, hidden)}
                </Text>
                <Text style={[styles.usd, { color: colors.mutedForeground }]}>
                  {hidden
                    ? '≈ $••••'
                    : `≈ $${wallet.usdEquivalent.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => promptReceive(wallet.currency)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon
                  name='arrow-down-left'
                  size={14}
                  color={colors.foreground}
                />
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>Receive</Text>
              </Pressable>
              <Pressable
                onPress={() => promptSend(wallet.currency)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionPrimary,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Icon
                  name='send'
                  size={14}
                  color={colors.background}
                />
                <Text style={[styles.actionLabel, { color: colors.background }]}>Send</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  total: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  totalHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
  eyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 10,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    padding: 12,
    gap: 12,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMeta: {
    flex: 1,
    gap: 2,
  },
  currency: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  name: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
  rowAmounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balance: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  usd: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPrimary: {
    borderWidth: 0,
  },
  actionLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
