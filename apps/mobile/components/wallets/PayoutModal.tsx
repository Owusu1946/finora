import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
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
    const sourceWallet = wallets.find((w) => w.id === sendWalletId);

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
      style={styles.sheet}
    >
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Send Payout</Text>
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
          <View style={styles.successState}>
            <Icon
              name='check'
              size={36}
              color={colors.foreground}
            />
            <Text style={[styles.successTitle, { color: colors.foreground }]}>
              Payout Submitted
            </Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              Sent ${sendAmount} via WeWire infrastructure. Policy verified.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Source Wallet</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {wallets.map((w) => (
                  <Pressable
                    key={`send-src-${w.id}`}
                    onPress={() => setSendWalletId(w.id)}
                    style={[
                      styles.walletChip,
                      {
                        backgroundColor: sendWalletId === w.id ? colors.foreground : colors.muted,
                      },
                    ]}
                  >
                    <CurrencyIcon
                      currency={w.currency}
                      size={18}
                    />
                    <Text
                      style={[
                        styles.walletChipText,
                        {
                          color: sendWalletId === w.id ? colors.background : colors.foreground,
                        },
                      ]}
                    >
                      {w.currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View>
              <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                Recipient (IBAN / MoMo / Address)
              </Text>
              <TextInput
                value={sendRecipient}
                onChangeText={setSendRecipient}
                placeholder='e.g. GB82 CLRB ... or +233 24 ...'
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>

            <View>
              <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Amount</Text>
              <TextInput
                value={sendAmount}
                onChangeText={setSendAmount}
                placeholder='0.00'
                keyboardType='numeric'
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>

            <Pressable
              onPress={handleExecuteSend}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.foreground },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>
                Confirm & Send Payout
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
  },
  formLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  walletChipText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    marginTop: 12,
  },
  primaryBtnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  successTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
  },
  successSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
