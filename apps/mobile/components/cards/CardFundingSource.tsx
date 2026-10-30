import { VIRTUAL_CARD_ISSUE_FEE_USD } from '@finora/shared';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WalletItem } from '@/components/wallets/types';

import { formatCardAmount } from '@/components/cards/types';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { canFundCard, cardFundingTotalUsd, fundingSourceKind } from '@/lib/card-funding';
import { haptics } from '@/lib/haptics';
import { listWallets, subscribeWallets, usdInWalletCurrency } from '@/lib/wallet-balances';

/** The user's wallets, kept current when a balance changes anywhere in the app. */
export function useFundingWallets() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  useEffect(() => {
    let disposed = false;
    const load = () =>
      void listWallets().then((next) => {
        if (!disposed) setWallets(next);
      });
    load();
    const unsubscribe = subscribeWallets(load);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);
  return wallets;
}

/** Preferred default: USD if it can cover the card, else the first wallet that can. */
export function defaultFundingWalletId(wallets: WalletItem[], amountUsd: number) {
  const usd = wallets.find((wallet) => wallet.currency === 'USD');
  if (usd && canFundCard(usd, amountUsd)) return usd.id;
  return wallets.find((wallet) => canFundCard(wallet, amountUsd))?.id ?? null;
}

/**
 * Pick the account a prepaid card is funded from. Accounts that can't cover the
 * load plus the issue fee are disabled.
 */
export function CardFundingSource({
  wallets,
  amountUsd,
  selectedId,
  onSelect,
}: {
  wallets: WalletItem[];
  amountUsd: number;
  selectedId: string | null;
  onSelect: (walletId: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View className='gap-2'>
      {wallets.map((wallet) => {
        const affordable = canFundCard(wallet, amountUsd);
        const selected = wallet.id === selectedId;
        return (
          <Pressable
            key={wallet.id}
            accessibilityRole='radio'
            accessibilityState={{ selected, disabled: !affordable }}
            accessibilityLabel={`${wallet.name}, ${fundingSourceKind(wallet)}`}
            disabled={!affordable}
            onPress={() => {
              haptics.selection();
              onSelect(wallet.id);
            }}
            className='min-h-[58px] flex-row items-center gap-3 rounded-[18px] border bg-background px-3.5 py-2.5 active:opacity-75'
            style={{
              borderCurve: 'continuous',
              borderColor: selected ? colors.foreground : colors.border,
              opacity: affordable ? 1 : 0.45,
            }}
          >
            <CurrencyIcon
              currency={wallet.currency}
              size={32}
            />
            <View className='flex-1 gap-0.5'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>{wallet.name}</Text>
              <Text className='font-sans text-[13px] text-muted-foreground'>
                {fundingSourceKind(wallet)} ·{' '}
                {affordable ? formatCardAmount(wallet.balance, wallet.currency) : 'Not enough'}
              </Text>
            </View>
            {selected ? (
              <Icon
                name='check'
                size={18}
                color={colors.foreground}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Load $50 + $1 issue fee = $51", plus the converted charge for non-USD accounts. */
export function CardFundingSummary({
  wallet,
  amountUsd,
}: {
  wallet: WalletItem | null;
  amountUsd: number;
}) {
  const total = cardFundingTotalUsd(amountUsd);
  return (
    <View className='gap-1'>
      <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
        Load {formatCardAmount(amountUsd, 'USD')} +{' '}
        {formatCardAmount(VIRTUAL_CARD_ISSUE_FEE_USD, 'USD')} issue fee ={' '}
        {formatCardAmount(total, 'USD')}
      </Text>
      {wallet && wallet.currency !== 'USD' ? (
        <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
          ≈{' '}
          {formatCardAmount(
            Math.round(usdInWalletCurrency(wallet, total) * 100) / 100,
            wallet.currency,
          )}{' '}
          from your {wallet.name} wallet
        </Text>
      ) : null}
    </View>
  );
}
