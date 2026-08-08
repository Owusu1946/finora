import { AppText as Text } from '@/components/ui/text';
import * as Clipboard from 'expo-clipboard';
import { useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';

import { SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AddWalletModal } from '@/components/wallets/AddWalletModal';
import { DepositModal } from '@/components/wallets/DepositModal';
import { FxConvertModal } from '@/components/wallets/FxConvertModal';
import { PayoutModal } from '@/components/wallets/PayoutModal';
import { WalletItem, INITIAL_WALLETS_DATA, FX_RATES } from '@/components/wallets/types';
import { WalletFilterTabs, FilterCategory } from '@/components/wallets/WalletFilterTabs';
import { WalletHeader } from '@/components/wallets/WalletHeader';
import { WalletListItem } from '@/components/wallets/WalletListItem';
import { Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAccountType, getAccountLabel } from '@/lib/account';
import { haptics } from '@/lib/haptics';

export default function WalletsScreen() {
  const { colors } = useTheme();
  const accountType = getAccountType();
  const accountLabel = getAccountLabel(accountType);

  const [wallets, setWallets] = useState<WalletItem[]>(INITIAL_WALLETS_DATA);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [hideBalances, setHideBalances] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected wallet for details/deposit view
  const [selectedWallet, setSelectedWallet] = useState<WalletItem | null>(null);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sleek Floating Toast */}
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: colors.foreground }]}>
          <Icon
            name='check'
            size={13}
            color={colors.background}
          />
          <Text style={[styles.toastText, { color: colors.background }]}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Header Section */}
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

        {/* 2. Filter Tabs Bar */}
        <WalletFilterTabs
          filter={filter}
          onSelectFilter={setFilter}
          onOpenAddWallet={() => setActiveModal('new_wallet')}
        />

        {/* 3. Wallet List */}
        <View style={styles.walletListContainer}>
          {filteredWallets.map((wallet, index) => (
            <WalletListItem
              key={wallet.id}
              wallet={wallet}
              hideBalances={hideBalances}
              isLast={index === filteredWallets.length - 1}
              onSelect={(w) => {
                setSelectedWallet(w);
                setActiveModal('deposit');
              }}
            />
          ))}
        </View>
      </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  toastText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
    maxWidth: Spacing.threadMaxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  walletListContainer: {
    flexDirection: 'column',
  },
});
