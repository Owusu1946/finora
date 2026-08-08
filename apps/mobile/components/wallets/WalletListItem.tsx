import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { WalletItem } from './types';

interface WalletListItemProps {
  wallet: WalletItem;
  hideBalances: boolean;
  isLast: boolean;
  onSelect: (wallet: WalletItem) => void;
}

export function WalletListItem({ wallet, hideBalances, isLast, onSelect }: WalletListItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onSelect(wallet);
      }}
      style={({ pressed }) => [
        styles.walletListItem,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.walletListLeft}>
        <CurrencyIcon
          currency={wallet.currency}
          size={38}
        />
        <View style={styles.walletMetaText}>
          <Text style={[styles.walletCode, { color: colors.foreground }]}>{wallet.currency}</Text>
          <Text style={[styles.walletBadgeText, { color: colors.mutedForeground }]}>
            {wallet.name} • {wallet.badge}
          </Text>
        </View>
      </View>

      <View style={styles.walletListRight}>
        <Text style={[styles.walletAmount, { color: colors.foreground }]}>
          {hideBalances
            ? '••••'
            : `${wallet.symbol}${wallet.balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </Text>
        <Text style={[styles.walletUsdEst, { color: colors.mutedForeground }]}>
          {hideBalances
            ? '••••'
            : `≈ $${wallet.usdEquivalent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  walletListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  walletListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletMetaText: {
    gap: 2,
  },
  walletCode: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  walletBadgeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '400',
  },
  walletListRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  walletAmount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  walletUsdEst: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '400',
  },
});
