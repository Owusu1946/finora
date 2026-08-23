import React from 'react';
import { Pressable, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
      className={cx(
        'flex-row items-center justify-between py-3.5 active:opacity-70',
        !isLast && 'border-b border-border',
      )}
    >
      <View className='flex-row items-center gap-3'>
        <CurrencyIcon
          currency={wallet.currency}
          size={38}
        />
        <View className='gap-0.5'>
          <Text className='font-sans-semibold text-base text-foreground'>{wallet.currency}</Text>
          <Text className='font-sans text-[13px] text-muted-foreground'>
            {wallet.name} • {wallet.badge}
          </Text>
        </View>
      </View>

      <View className='items-end gap-0.5'>
        <Text className='font-sans-semibold text-base text-foreground'>
          {hideBalances
            ? '••••'
            : `${wallet.symbol}${wallet.balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </Text>
        <Text className='font-sans text-[13px] text-muted-foreground'>
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
