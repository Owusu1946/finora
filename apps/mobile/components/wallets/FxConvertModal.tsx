import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Keyboard,
  Platform,
  InputAccessoryView,
} from 'react-native';

import { CurrencyIcon, type SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { WalletItem, FX_RATES } from './types';

type PickerSide = 'pay' | 'receive' | null;

const AMOUNT_ACCESSORY_ID = 'fx-swap-amount-done';

function dismissKeyboard() {
  Keyboard.dismiss();
}

interface FxConvertModalProps {
  visible: boolean;
  wallets: WalletItem[];
  onClose: () => void;
  onConvertSuccess: (
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    amountNum: number,
    convertedValue: number,
  ) => void;
}

function formatBalance(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CurrencyPill({
  currency,
  onPress,
  colors,
}: {
  currency: SupportedCurrency;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.currencyPill,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CurrencyIcon
        currency={currency}
        size={22}
      />
      <Text style={[styles.currencyPillCode, { color: colors.foreground }]}>{currency}</Text>
      <Icon
        name='chevron-down'
        size={16}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

export function FxConvertModal({
  visible,
  wallets,
  onClose,
  onConvertSuccess,
}: FxConvertModalProps) {
  const { colors } = useTheme();

  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>('USD');
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>('GHS');
  const [convertAmount, setConvertAmount] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState(false);
  const [picker, setPicker] = useState<PickerSide>(null);

  useEffect(() => {
    if (!visible) return;
    const pay = wallets[0]?.currency ?? 'USD';
    const receive =
      wallets.find((w) => w.currency !== pay)?.currency ?? wallets[1]?.currency ?? 'GHS';
    setFromCurrency(pay);
    setToCurrency(receive);
    setConvertAmount('');
    setIsConverting(false);
    setConvertSuccess(false);
    setPicker(null);
  }, [visible, wallets]);

  const fromWallet = useMemo(
    () => wallets.find((w) => w.currency === fromCurrency),
    [wallets, fromCurrency],
  );
  const toWallet = useMemo(
    () => wallets.find((w) => w.currency === toCurrency),
    [wallets, toCurrency],
  );

  const amountNum = parseFloat(convertAmount) || 0;
  const receiveAmount = useMemo(() => {
    const fromRate = FX_RATES[fromCurrency] || 1;
    const toRate = FX_RATES[toCurrency] || 1;
    return (amountNum * fromRate) / toRate;
  }, [amountNum, fromCurrency, toCurrency]);

  const insufficient = amountNum > 0 && (fromWallet?.balance ?? 0) < amountNum;
  const canSwap =
    amountNum > 0 &&
    !insufficient &&
    fromCurrency !== toCurrency &&
    Boolean(fromWallet && toWallet) &&
    !isConverting;

  const rateLabel = useMemo(() => {
    const fromRate = FX_RATES[fromCurrency] || 1;
    const toRate = FX_RATES[toCurrency] || 1;
    const one = fromRate / toRate;
    return `1 ${fromCurrency} ≈ ${one.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${toCurrency}`;
  }, [fromCurrency, toCurrency]);

  const handleFlip = () => {
    dismissKeyboard();
    haptics.selection();
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    if (amountNum > 0) {
      setConvertAmount(
        receiveAmount.toLocaleString(undefined, {
          maximumFractionDigits: 6,
          useGrouping: false,
        }),
      );
    }
  };

  const openPicker = (side: PickerSide) => {
    dismissKeyboard();
    setPicker(side);
  };

  const handleSelectCurrency = (currency: SupportedCurrency) => {
    haptics.selection();
    if (picker === 'pay') {
      if (currency === toCurrency) setToCurrency(fromCurrency);
      setFromCurrency(currency);
    } else if (picker === 'receive') {
      if (currency === fromCurrency) setFromCurrency(toCurrency);
      setToCurrency(currency);
    }
    setPicker(null);
  };

  const handleMax = () => {
    if (!fromWallet) return;
    dismissKeyboard();
    haptics.selection();
    setConvertAmount(
      fromWallet.balance.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        useGrouping: false,
      }),
    );
  };

  const handleClose = () => {
    dismissKeyboard();
    onClose();
  };

  const handleExecuteConversion = () => {
    if (!canSwap || !fromWallet || !toWallet) return;
    dismissKeyboard();
    haptics.impact();
    setIsConverting(true);

    setTimeout(() => {
      onConvertSuccess(fromCurrency, toCurrency, amountNum, receiveAmount);
      setConvertSuccess(true);
      setIsConverting(false);
      setTimeout(() => {
        setConvertSuccess(false);
        onClose();
      }, 1400);
    }, 700);
  };

  const pickerWallets = wallets.filter((w) =>
    picker === 'pay' ? w.currency !== toCurrency : w.currency !== fromCurrency,
  );

  return (
    <>
      <SheetModal
        visible={visible}
        onClose={handleClose}
        keyboardAvoiding
        style={styles.sheetContainer}
      >
        <View style={styles.sheetHeader}>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={[styles.headerIconBtn, { backgroundColor: colors.muted }]}
          >
            <Icon
              name='chevron-left'
              size={20}
              color={colors.foreground}
            />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Swap money</Text>
          <View style={styles.headerIconBtn} />
        </View>

        {convertSuccess ? (
          <View style={styles.successState}>
            <Icon
              name='check'
              size={36}
              color={colors.foreground}
            />
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Swap complete</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              {formatBalance(amountNum)} {fromCurrency} → {formatBalance(receiveAmount)}{' '}
              {toCurrency}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
                <View style={styles.swapStack}>
                  <View style={[styles.legCard, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.legLabel, { color: colors.mutedForeground }]}>Pay</Text>
                    <View style={styles.legRow}>
                      <TextInput
                        value={convertAmount}
                        onChangeText={(t) => setConvertAmount(t.replace(/[^0-9.]/g, ''))}
                        placeholder='0'
                        keyboardType='decimal-pad'
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.amountInput, { color: colors.foreground }]}
                        inputAccessoryViewID={
                          Platform.OS === 'ios' ? AMOUNT_ACCESSORY_ID : undefined
                        }
                      />
                      <CurrencyPill
                        currency={fromCurrency}
                        onPress={() => openPicker('pay')}
                        colors={colors}
                      />
                    </View>
                    <View style={styles.availableRow}>
                      <Text style={[styles.availableText, { color: colors.mutedForeground }]}>
                        Available {fromCurrency} {formatBalance(fromWallet?.balance ?? 0)}
                      </Text>
                      <Pressable
                        onPress={handleMax}
                        style={[styles.maxBadge, { backgroundColor: colors.foreground }]}
                      >
                        <Text style={[styles.maxBadgeText, { color: colors.background }]}>Max</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.flipWrap}>
                    <Pressable
                      onPress={handleFlip}
                      style={({ pressed }) => [
                        styles.flipBtn,
                        {
                          backgroundColor: colors.foreground,
                          borderColor: colors.background,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name='swap-vert'
                        size={22}
                        color={colors.background}
                      />
                    </Pressable>
                  </View>

                  <View style={[styles.legCard, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.legLabel, { color: colors.mutedForeground }]}>
                      Receive
                    </Text>
                    <View style={styles.legRow}>
                      <Text
                        style={[styles.amountInput, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {amountNum > 0 ? formatBalance(receiveAmount) : '0'}
                      </Text>
                      <CurrencyPill
                        currency={toCurrency}
                        onPress={() => openPicker('receive')}
                        colors={colors}
                      />
                    </View>
                  </View>
                </View>

                {insufficient ? (
                  <View style={[styles.warnRow, { backgroundColor: colors.destructiveSurface }]}>
                    <Icon
                      name='info'
                      size={16}
                      color={colors.destructive}
                    />
                    <Text style={[styles.warnText, { color: colors.destructive }]}>
                      Insufficient {fromCurrency} balance. Required: {formatBalance(amountNum)}.
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.rateHint, { color: colors.mutedForeground }]}>
                    {rateLabel}
                  </Text>
                )}

            <Pressable
              onPress={handleExecuteConversion}
              disabled={!canSwap}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.foreground,
                  opacity: !canSwap ? 0.35 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>
                {isConverting ? 'Swapping…' : `Swap ${fromCurrency} → ${toCurrency}`}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SheetModal>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
          <View
            style={[
              styles.accessoryBar,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={dismissKeyboard}
              hitSlop={8}
              style={styles.accessoryDone}
            >
              <Text style={[styles.accessoryDoneText, { color: colors.foreground }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      <SheetModal
        visible={picker !== null}
        onClose={() => setPicker(null)}
        style={styles.pickerSheet}
      >
        <View style={styles.pickerHeader}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select currency</Text>
          <Pressable
            onPress={() => setPicker(null)}
            hitSlop={8}
            style={[styles.headerIconBtn, { backgroundColor: colors.muted }]}
          >
            <Icon
              name='remove'
              size={18}
              color={colors.foreground}
            />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pickerList}
        >
          {pickerWallets.map((w) => {
            const selected =
              picker === 'pay' ? w.currency === fromCurrency : w.currency === toCurrency;
            return (
              <Pressable
                key={w.id}
                onPress={() => handleSelectCurrency(w.currency)}
                style={({ pressed }) => [
                  styles.pickerRow,
                  {
                    backgroundColor: selected ? colors.muted : colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <CurrencyIcon
                  currency={w.currency}
                  size={36}
                />
                <View style={styles.pickerMeta}>
                  <Text style={[styles.pickerCode, { color: colors.foreground }]}>
                    {w.currency}
                  </Text>
                  <Text style={[styles.pickerName, { color: colors.mutedForeground }]}>
                    {w.name}
                  </Text>
                </View>
                <Text style={[styles.pickerBalance, { color: colors.foreground }]}>
                  {formatBalance(w.balance)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheetContainer: {
    paddingHorizontal: 20,
    gap: 8,
    minHeight: '72%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    gap: 16,
    flexGrow: 1,
    paddingBottom: 8,
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessoryDone: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  accessoryDoneText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
  },
  swapStack: {
    gap: 12,
  },
  legCard: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  legLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 35,
    fontWeight: '600',
    letterSpacing: -0.5,
    paddingVertical: 0,
    minHeight: 42,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  currencyPillCode: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '700',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  availableText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  maxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  maxBadgeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '700',
  },
  flipWrap: {
    zIndex: 2,
    alignItems: 'center',
    marginVertical: -22,
  },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  warnText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  rateHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Radius.pill,
  },
  primaryBtnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '700',
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 48,
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
  pickerSheet: {
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickerTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
  },
  pickerList: {
    gap: 8,
    paddingBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerMeta: {
    flex: 1,
    gap: 2,
  },
  pickerCode: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  pickerBalance: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
