import { MAX_VIRTUAL_CARD_LIMIT } from '@finora/shared';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  CardFundingSource,
  CardFundingSummary,
  defaultFundingWalletId,
  useFundingWallets,
} from '@/components/cards/CardFundingSource';
import { formatCardAmount, remainingLimit, type VirtualCard } from '@/components/cards/types';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { canFundCard } from '@/lib/card-funding';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

const AMOUNT_CHIPS = [10, 20, 50, 100];

export type CardTopUpChoice = { amountUsd: number; walletId: string };

/**
 * Collects a top-up amount and funding account. It only reports the choice;
 * the caller confirms with the passcode after the sheet has closed, since a
 * passcode modal can't be presented over a native sheet that is dismissing.
 */
export function CardTopUpSheet({
  card,
  visible,
  onClose,
  onDismissed,
  onConfirm,
}: {
  card: VirtualCard;
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  onConfirm: (choice: CardTopUpChoice) => void;
}) {
  const { colors } = useTheme();
  const wallets = useFundingWallets();
  const [amountText, setAmountText] = useState('20');
  const [walletId, setWalletId] = useState<string | null>(null);
  const amountUsd = Number(amountText) || 0;
  const fundingWallet = wallets.find((wallet) => wallet.id === walletId) ?? null;
  const overMax = card.spendLimit + amountUsd > MAX_VIRTUAL_CARD_LIMIT;
  const canConfirm =
    amountUsd > 0 && !overMax && fundingWallet !== null && canFundCard(fundingWallet, amountUsd);

  useEffect(() => {
    if (!visible) return;
    setAmountText('20');
  }, [visible]);

  // Keep a funding account selected that can cover the top-up as the amount changes.
  useEffect(() => {
    if (amountUsd <= 0) return;
    if (fundingWallet && canFundCard(fundingWallet, amountUsd)) return;
    setWalletId(defaultFundingWalletId(wallets, amountUsd));
  }, [amountUsd, fundingWallet, wallets]);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      style={{ paddingHorizontal: 20, gap: 16 }}
    >
      <View className='gap-1'>
        <Text className='font-sans-semibold text-xl text-foreground'>Top up {card.label} card</Text>
        <Text className='font-sans text-[14px] text-muted-foreground'>
          {formatCardAmount(remainingLimit(card), 'USD')} left on this card
        </Text>
      </View>

      <View className='gap-2.5'>
        <View className='flex-row flex-wrap gap-2'>
          {AMOUNT_CHIPS.map((value) => {
            const selected = amountUsd === value;
            return (
              <Pressable
                key={value}
                accessibilityRole='button'
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.selection();
                  setAmountText(String(value));
                }}
                className={cx(
                  'rounded-full border px-4 py-2',
                  selected ? 'border-foreground bg-foreground' : 'border-border bg-background',
                )}
              >
                <Text
                  className='font-sans-medium text-sm'
                  style={{ color: selected ? colors.background : colors.foreground }}
                >
                  {formatCardAmount(value, 'USD')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          className='min-h-[52px] flex-row items-center rounded-[32px] border border-border bg-background px-3.5'
          style={{ borderCurve: 'continuous' }}
        >
          <Text className='mr-2 font-sans-semibold text-base text-muted-foreground'>USD</Text>
          <TextInput
            value={amountText}
            onChangeText={(value) => setAmountText(value.replace(/[^0-9.]/g, ''))}
            keyboardType='decimal-pad'
            placeholder='Amount'
            placeholderTextColor={colors.mutedForeground}
            className='flex-1 py-0 font-sans-semibold text-[18px] text-foreground'
          />
        </View>
        {overMax ? (
          <Text className='font-sans text-[13px] text-destructive'>
            A card can hold up to {formatCardAmount(MAX_VIRTUAL_CARD_LIMIT, 'USD')} in total.
          </Text>
        ) : null}
      </View>

      <View className='gap-2'>
        <Text className='font-sans-semibold text-[15px] text-foreground'>Fund from</Text>
        <CardFundingSource
          wallets={wallets}
          amountUsd={amountUsd}
          selectedId={walletId}
          onSelect={setWalletId}
        />
        {amountUsd > 0 ? (
          <CardFundingSummary
            wallet={fundingWallet}
            amountUsd={amountUsd}
            verb='Add'
            feeLabel='top-up fee'
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole='button'
        disabled={!canConfirm}
        onPress={() => {
          if (!canConfirm || !walletId) return;
          haptics.selection();
          onConfirm({ amountUsd, walletId });
        }}
        className='min-h-[52px] items-center justify-center rounded-full bg-foreground px-[18px] active:opacity-75 disabled:opacity-40'
      >
        <Text className='font-sans-semibold text-base text-background'>
          {amountUsd > 0 ? `Top up ${formatCardAmount(amountUsd, 'USD')}` : 'Top up'}
        </Text>
      </Pressable>
    </SheetModal>
  );
}
