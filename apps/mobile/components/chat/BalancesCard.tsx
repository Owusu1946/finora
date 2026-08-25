import { useAui } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
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
type BalancesCardProps = { wallets: BalanceWallet[]; totalUsd?: number };
const receivePrompt = (currency: string) =>
  currency === 'GHS'
    ? 'Receive money via MoMo'
    : currency === 'USDT' || currency === 'USDC'
      ? `Show my ${currency} address`
      : `Receive money in ${currency}`;
const amount = (symbol: string, value: number, hidden: boolean) =>
  hidden
    ? `${symbol}******`
    : `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BalancesCard({ wallets, totalUsd }: BalancesCardProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const [hidden, setHidden] = useState(false);
  const total =
    totalUsd ??
    wallets.reduce(
      (sum, wallet) => sum + (Number.isFinite(wallet.usdEquivalent) ? wallet.usdEquivalent : 0),
      0,
    );
  const prompt = (text: string) => {
    haptics.selection();
    sendChatPrompt(aui, text);
  };
  return (
    <View
      className='my-2 w-full overflow-hidden border border-border bg-card'
      style={styles.card}
    >
      <View className='flex-row items-start gap-3 px-4 pb-4 pt-4'>
        <View className='flex-1 gap-1'>
          <Text className='font-sans-medium text-[12px] uppercase text-muted-foreground'>
            Portfolio balance
          </Text>
          <Text className='font-sans-semibold text-[30px] text-foreground'>
            {hidden
              ? '$******'
              : `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Text>
          <Text className='font-sans text-[12px] text-muted-foreground'>
            USD equivalent across {wallets.length} wallet{wallets.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'}
          hitSlop={10}
          onPress={() => {
            haptics.selection();
            setHidden((value) => !value);
          }}
          className='h-9 w-9 items-center justify-center rounded-full bg-muted'
        >
          <Icon
            name={hidden ? 'eye-off' : 'eye'}
            size={18}
            color={colors.foreground}
          />
        </Pressable>
      </View>
      <View className='border-t border-border px-4'>
        {wallets.map((wallet, index) => (
          <View
            key={wallet.id}
            className={`gap-2.5 py-3.5 ${index ? 'border-t border-border' : ''}`}
          >
            <View className='flex-row items-center gap-3'>
              <CurrencyIcon
                currency={wallet.currency}
                size={36}
              />
              <View className='min-w-0 flex-1 gap-0.5'>
                <Text className='font-sans-semibold text-[15px] text-foreground'>
                  {wallet.currency}
                </Text>
                <Text
                  numberOfLines={1}
                  className='font-sans text-[12px] text-muted-foreground'
                >
                  {wallet.name}
                </Text>
              </View>
              <View className='items-end gap-0.5'>
                <Text
                  numberOfLines={1}
                  className='font-sans-semibold text-[16px] text-foreground'
                >
                  {amount(wallet.symbol, wallet.balance, hidden)}
                </Text>
                <Text className='font-sans text-[12px] text-muted-foreground'>
                  {hidden
                    ? 'USD ******'
                    : `USD $${wallet.usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Text>
              </View>
            </View>
            <View className='flex-row gap-2 pl-12'>
              <Pressable
                accessibilityLabel={`Receive ${wallet.currency}`}
                onPress={() => prompt(receivePrompt(wallet.currency))}
                className='h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full'
                style={{ flex: 1, backgroundColor: colors.muted }}
              >
                <Icon
                  name='arrow-down-left'
                  size={14}
                  color={colors.foreground}
                />
                <Text
                  style={{ color: colors.foreground }}
                  className='font-sans-semibold text-[13px]'
                >
                  Receive
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Send ${wallet.currency}`}
                onPress={() => prompt(`Send money from my ${wallet.currency} wallet`)}
                className='h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-85'
                style={{ flex: 1, backgroundColor: colors.primary }}
              >
                <Icon
                  name='send'
                  size={14}
                  color={colors.primaryForeground}
                />
                <Text
                  className='font-sans-semibold text-[13px]'
                  style={{ color: colors.primaryForeground }}
                >
                  Send
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
const styles = { card: { borderRadius: Radius.lg } };
