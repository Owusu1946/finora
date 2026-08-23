import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

interface WalletHeaderProps {
  accountLabel: string;
  totalNetWorthUSD: number;
  hideBalances: boolean;
  onToggleHideBalances: () => void;
  onOpenSend: () => void;
  onOpenDeposit: () => void;
  onOpenConvert: () => void;
}

export function WalletHeader({
  accountLabel,
  totalNetWorthUSD,
  hideBalances,
  onToggleHideBalances,
  onOpenSend,
  onOpenDeposit,
  onOpenConvert,
}: WalletHeaderProps) {
  const { colors } = useTheme();

  return (
    <View className='gap-1.5 pt-1'>
      <View className='flex-row items-center justify-between'>
        <Text className='font-sans-medium text-sm text-muted-foreground'>
          {accountLabel} Net Worth
        </Text>

        <Pressable
          hitSlop={8}
          onPress={() => {
            haptics.selection();
            onToggleHideBalances();
          }}
          className='p-1'
        >
          <Icon
            name={hideBalances ? 'eye-off' : 'eye'}
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <Text className='my-1 font-sans-semibold text-[35px] text-foreground'>
        {hideBalances
          ? '••••••••'
          : `$${totalNetWorthUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
      </Text>

      {/* Minimal Quick Actions Row */}
      <View className='mt-2 flex-row gap-2.5'>
        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenSend();
          }}
          className='flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-transparent bg-foreground py-2.5 active:opacity-80'
        >
          <Icon
            name='arrow-up'
            size={15}
            color={colors.background}
          />
          <Text className='font-sans-semibold text-sm text-background'>Payout</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenDeposit();
          }}
          className='flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border bg-muted py-2.5 active:opacity-80'
        >
          <Icon
            name='arrow-down-left'
            size={15}
            color={colors.foreground}
          />
          <Text className='font-sans-semibold text-sm text-foreground'>Deposit</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenConvert();
          }}
          className='flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border bg-muted py-2.5 active:opacity-80'
        >
          <Icon
            name='swap'
            size={15}
            color={colors.foreground}
          />
          <Text className='font-sans-semibold text-sm text-foreground'>Convert</Text>
        </Pressable>
      </View>
    </View>
  );
}
