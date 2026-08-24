import { useHeaderHeight } from '@react-navigation/elements';
import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { AddWalletModal } from '@/components/wallets/AddWalletModal';
import { DepositModal } from '@/components/wallets/DepositModal';
import { FxConvertModal } from '@/components/wallets/FxConvertModal';
import { PayoutModal } from '@/components/wallets/PayoutModal';
import { WalletItem, INITIAL_WALLETS_DATA, FX_RATES } from '@/components/wallets/types';
import { WalletFilterTabs, FilterCategory } from '@/components/wallets/WalletFilterTabs';
import { WalletHeader } from '@/components/wallets/WalletHeader';
import { WalletListItem } from '@/components/wallets/WalletListItem';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, getAccountLabel } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listVirtualCards, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

export default function WalletsScreen() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const accountType = getAccountType();
  const accountLabel = getAccountLabel(accountType);

  const [wallets, setWallets] = useState<WalletItem[]>(INITIAL_WALLETS_DATA);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [hideBalances, setHideBalances] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected wallet for details/deposit view
  const [selectedWallet, setSelectedWallet] = useState<WalletItem | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let newestRequest = 0;

    const refreshCards = () => {
      const request = ++newestRequest;
      void listVirtualCards().then((cards) => {
        if (disposed || request !== newestRequest) return;
        setCardCount(cards.filter((card) => card.status !== 'cancelled').length);
      });
    };
    refreshCards();
    const unsubscribe = subscribeVirtualCards(refreshCards);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  // Active modal handler
  const [activeModal, setActiveModal] = useState<
    'send' | 'deposit' | 'convert' | 'new_wallet' | null
  >(null);

  // Total USD equivalent balance calculation
  const totalNetWorthUSD = useMemo(() => {
    return wallets.reduce((acc, w) => acc + w.usdEquivalent, 0);
  }, [wallets]);

  // Filtered wallet list
  const filteredWallets = useMemo(() => {
    if (filter === 'all') return wallets;
    return wallets.filter((w) => w.type === filter);
  }, [wallets, filter]);

  const showToast = (msg: string) => {
    haptics.selection();
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showToast(`${label} copied`);
  };

  const handleConvertSuccess = (
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    amountNum: number,
    convertedValue: number,
  ) => {
    const fromRateInUSD = FX_RATES[fromCurrency] || 1;
    const toRateInUSD = FX_RATES[toCurrency] || 1;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.currency === fromCurrency) {
          return {
            ...w,
            balance: w.balance - amountNum,
            usdEquivalent: (w.balance - amountNum) * fromRateInUSD,
          };
        }
        if (w.currency === toCurrency) {
          return {
            ...w,
            balance: w.balance + convertedValue,
            usdEquivalent: (w.balance + convertedValue) * toRateInUSD,
          };
        }
        return w;
      }),
    );
  };

  const handleSendSuccess = (sendWalletId: string, amountNum: number) => {
    const sourceWallet = wallets.find((w) => w.id === sendWalletId);
    if (!sourceWallet) return;
    const rateInUSD = FX_RATES[sourceWallet.currency] || 1;

    setWallets((prev) =>
      prev.map((w) =>
        w.id === sendWalletId
          ? {
              ...w,
              balance: w.balance - amountNum,
              usdEquivalent: (w.balance - amountNum) * rateInUSD,
            }
          : w,
      ),
    );
  };

  return (
    <View className='flex-1 bg-background'>
      {/* Sleek Floating Toast */}
      {toastMessage && (
        <View
          className='absolute z-[99] flex-row items-center self-center rounded-full bg-foreground px-3 py-1.5'
          style={{ top: headerHeight + 12 }}
        >
          <Icon
            name='check'
            size={13}
            color={colors.background}
          />
          <Text className='font-sans-semibold text-[13px] text-background'>{toastMessage}</Text>
        </View>
      )}

      <CollapsibleList
        title='Wallets'
        data={filteredWallets}
        intro={
          <View className='gap-6 pb-6'>
            <View className='gap-3'>
              <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
                Wallets
              </Text>
              <WalletHeader
                accountLabel={accountLabel}
                totalNetWorthUSD={totalNetWorthUSD}
                hideBalances={hideBalances}
                onToggleHideBalances={() => setHideBalances((prev) => !prev)}
                onOpenSend={() => setActiveModal('send')}
                onOpenDeposit={() => {
                  setSelectedWallet(wallets[0]);
                  setActiveModal('deposit');
                }}
                onOpenConvert={() => setActiveModal('convert')}
              />
            </View>
            {cardCount === 0 ? (
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push('/virtual-card' as Href);
                }}
                className='flex-row items-center gap-3 rounded-[26px] border border-border bg-muted p-3.5'
                style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
              >
                <View className='size-9 items-center justify-center rounded-xl bg-foreground'>
                  <Icon
                    name='wallet'
                    size={17}
                    color={colors.background}
                  />
                </View>
                <View className='flex-1 gap-0.5'>
                  <Text className='font-sans-semibold text-[15px] text-foreground'>
                    Virtual card
                  </Text>
                  <Text className='font-sans text-[13px] text-muted-foreground'>
                    Create a card for online spending
                  </Text>
                </View>
                <Icon
                  name='chevron-right'
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>
        }
        controls={
          <WalletFilterTabs
            filter={filter}
            onSelectFilter={setFilter}
            onOpenAddWallet={() => setActiveModal('new_wallet')}
          />
        }
        renderItem={(wallet, _index, isLast) => (
          <WalletListItem
            wallet={wallet}
            hideBalances={hideBalances}
            isLast={isLast}
            onSelect={(selected) => {
              setSelectedWallet(selected);
              setActiveModal('deposit');
            }}
          />
        )}
        keyExtractor={(wallet) => wallet.id}
        getItemType={() => 'wallet'}
      />

      {/* Modals */}
      <DepositModal
        visible={activeModal === 'deposit'}
        selectedWallet={selectedWallet}
        onClose={() => setActiveModal(null)}
        onCopy={handleCopy}
      />

      <PayoutModal
        visible={activeModal === 'send'}
        wallets={wallets}
        onClose={() => setActiveModal(null)}
        onSendSuccess={handleSendSuccess}
      />

      <FxConvertModal
        visible={activeModal === 'convert'}
        wallets={wallets}
        onClose={() => setActiveModal(null)}
        onConvertSuccess={handleConvertSuccess}
      />

      <AddWalletModal
        visible={activeModal === 'new_wallet'}
        onClose={() => setActiveModal(null)}
      />
    </View>
  );
}
