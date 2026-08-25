import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { WalletItem } from './types';

interface PayoutModalProps {
  visible: boolean;
  wallets: WalletItem[];
  onClose: () => void;
  onSendSuccess: (sendWalletId: string, amountNum: number) => void;
}

export function PayoutModal({ visible, wallets, onClose, onSendSuccess }: PayoutModalProps) {
  const { colors } = useTheme();

  const [sendWalletId, setSendWalletId] = useState(wallets[0]?.id || 'w-usd');
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleExecuteSend = () => {
    if (!sendAmount || !sendRecipient) return;
    haptics.impact();
    const amountNum = parseFloat(sendAmount);
    const sourceWallet = wallets.find((wallet) => wallet.id === sendWalletId);

    if (!sourceWallet || sourceWallet.balance < amountNum) {
      alert('Insufficient wallet balance.');
      return;
    }

    onSendSuccess(sendWalletId, amountNum);
    setSendSuccess(true);
    setTimeout(() => {
      setSendSuccess(false);
      setSendAmount('');
      setSendRecipient('');
      onClose();
    }, 1600);
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      keyboardAvoiding
      style={{ paddingHorizontal: 20, gap: 16 }}
    >
      <View className='flex-row items-center justify-between'>
        <Text className='font-sans-semibold text-lg text-foreground'>Send Payout</Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
        >
          <Icon
            name='remove'
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {sendSuccess ? (
          <View className='items-center gap-2 py-5'>
            <Icon
              name='check'
              size={36}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-lg text-foreground'>Payout Submitted</Text>
            <Text className='text-center font-sans text-sm text-muted-foreground'>
              Sent ${sendAmount} via WeWire infrastructure. Policy verified.
            </Text>
          </View>
        ) : (
          <View className='gap-3.5'>
            <Text className='mb-1 font-sans-medium text-[13px] text-muted-foreground'>
              Source Wallet
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <View className='flex-row gap-2'>
                {wallets.map((wallet) => {
                  const selected = sendWalletId === wallet.id;
                  return (
                    <Pressable
                      key={`send-src-${wallet.id}`}
                      onPress={() => setSendWalletId(wallet.id)}
                      className='flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5'
                      style={{ backgroundColor: selected ? colors.foreground : colors.muted }}
                    >
                      <CurrencyIcon
                        currency={wallet.currency}
                        size={18}
                      />
                      <Text
                        className='font-sans-semibold text-[13px]'
                        style={{ color: selected ? colors.background : colors.foreground }}
                      >
                        {wallet.currency}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View>
              <Text className='mb-1 font-sans-medium text-[13px] text-muted-foreground'>
                Recipient (IBAN / MoMo / Address)
              </Text>
              <TextInput
                value={sendRecipient}
                onChangeText={setSendRecipient}
                placeholder='e.g. GB82 CLRB ... or +233 24 ...'
                placeholderTextColor={colors.mutedForeground}
                className='rounded-xl border border-border bg-muted px-3 py-2.5 font-sans text-base text-foreground'
              />
            </View>

            <View>
              <Text className='mb-1 font-sans-medium text-[13px] text-muted-foreground'>
                Amount
              </Text>
              <TextInput
                value={sendAmount}
                onChangeText={setSendAmount}
                placeholder='0.00'
                keyboardType='numeric'
                placeholderTextColor={colors.mutedForeground}
                className='rounded-xl border border-border bg-muted px-3 py-2.5 font-sans text-base text-foreground'
              />
            </View>

            <Pressable
              onPress={handleExecuteSend}
              className='mt-3 flex-row items-center justify-center gap-1.5 rounded-full bg-primary py-3 active:opacity-80'
            >
              <Text className='font-sans-semibold text-[15px] text-primary-foreground'>
                Confirm & Send Payout
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SheetModal>
  );
}
