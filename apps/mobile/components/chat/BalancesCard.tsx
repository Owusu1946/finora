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
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
      <View className='flex-row items-start gap-3'>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-medium text-[14px] tracking-[-0.1px] text-muted-foreground'>
            Balances
          </Text>
          <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
            {hidden
              ? '$••••••'
              : `$${total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </Text>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
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
          className='w-9 h-9 rounded-[18px] items-center justify-center'
          style={({ pressed }) => [{ backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon
            name={hidden ? 'eye-off' : 'eye'}
            size={18}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <View className='gap-2.5'>
        {wallets.map((wallet) => (
          <View
            key={wallet.id}
            className='border p-3 gap-3 border-border'
            style={[styles.row]}
          >
            <View className='flex-row items-center gap-2.5'>
              <CurrencyIcon
                currency={wallet.currency}
                size={34}
              />
              <View className='flex-1 gap-0.5'>
                <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                  {wallet.currency}
                </Text>
                <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                  {wallet.name}
                </Text>
              </View>
              <View className='items-end gap-0.5'>
                <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                  {maskAmount(wallet.symbol, wallet.balance, hidden)}
                </Text>
                <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                  {hidden
                    ? '≈ $••••'
                    : `≈ $${wallet.usdEquivalent.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </Text>
              </View>
            </View>

            <View className='flex-row gap-2'>
              <Pressable
                onPress={() => promptReceive(wallet.currency)}
                className='flex-1 min-h-10 border flex-row items-center justify-center gap-1.5'
                style={({ pressed }) => [
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
                <Text className='font-sans-semibold text-[14px] tracking-[-0.1px] text-foreground'>
                  Receive
                </Text>
              </Pressable>
              <Pressable
                onPress={() => promptSend(wallet.currency)}
                className='flex-1 min-h-10 border flex-row items-center justify-center gap-1.5 border-0'
                style={({ pressed }) => [
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
                <Text className='font-sans-semibold text-[14px] tracking-[-0.1px] text-background'>
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

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  row: {
    borderRadius: Radius.composer,
  },
  actionBtn: {
    borderRadius: Radius.pill,
  },
};
