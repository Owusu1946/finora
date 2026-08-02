import React, { useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Modal, TextInput } from "react-native";

import { SupportedCurrency } from "@/components/ui/currency-icon";
import { Icon } from "@/components/ui/icon";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { haptics } from "@/lib/haptics";

import { WalletItem, FX_RATES } from "./types";

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

export function FxConvertModal({
  visible,
  wallets,
  onClose,
  onConvertSuccess,
}: FxConvertModalProps) {
  const { colors } = useTheme();

  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>("USD");
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>("GHS");
  const [convertAmount, setConvertAmount] = useState("100");
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState(false);

  const handleExecuteConversion = () => {
    if (!convertAmount || parseFloat(convertAmount) <= 0) return;
    haptics.impact();
    setIsConverting(true);

    setTimeout(() => {
      const amountNum = parseFloat(convertAmount);
      const fromWallet = wallets.find((w) => w.currency === fromCurrency);
      const toWallet = wallets.find((w) => w.currency === toCurrency);

      if (fromWallet && toWallet && fromWallet.balance >= amountNum) {
        const fromRateInUSD = FX_RATES[fromCurrency] || 1;
        const toRateInUSD = FX_RATES[toCurrency] || 1;

        const valueInUSD = amountNum * fromRateInUSD;
        const convertedValue = valueInUSD / toRateInUSD;

        onConvertSuccess(fromCurrency, toCurrency, amountNum, convertedValue);
        setConvertSuccess(true);
        setTimeout(() => {
          setConvertSuccess(false);
          onClose();
        }, 1600);
      } else {
        alert("Insufficient balance for conversion.");
      }
      setIsConverting(false);
    }, 800);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Instant FX Conversion
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="remove" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {convertSuccess ? (
            <View style={styles.successState}>
              <Icon name="check" size={36} color={colors.foreground} />
              <Text style={[styles.successTitle, { color: colors.foreground }]}>
                Converted Successfully
              </Text>
              <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                {convertAmount} {fromCurrency} converted to {toCurrency}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {/* From / To selector */}
              <View style={styles.fxSelectorRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>From</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {wallets.map((w) => (
                        <Pressable
                          key={`from-fx-${w.id}`}
                          onPress={() => setFromCurrency(w.currency)}
                          style={[
                            styles.miniFxChip,
                            {
                              backgroundColor:
                                fromCurrency === w.currency ? colors.foreground : colors.muted,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color:
                                fromCurrency === w.currency ? colors.background : colors.foreground,
                            }}
                          >
                            {w.currency}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <Icon name="swap" size={16} color={colors.mutedForeground} />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {wallets.map((w) => (
                        <Pressable
                          key={`to-fx-${w.id}`}
                          onPress={() => setToCurrency(w.currency)}
                          style={[
                            styles.miniFxChip,
                            {
                              backgroundColor:
                                toCurrency === w.currency ? colors.foreground : colors.muted,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color:
                                toCurrency === w.currency ? colors.background : colors.foreground,
                            }}
                          >
                            {w.currency}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                  Amount ({fromCurrency})
                </Text>
                <TextInput
                  value={convertAmount}
                  onChangeText={setConvertAmount}
                  placeholder="100"
                  keyboardType="numeric"
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

              <View style={[styles.fxCalcPreview, { backgroundColor: colors.muted }]}>
                <Text style={[styles.fxCalcLabel, { color: colors.mutedForeground }]}>
                  Estimated Receive
                </Text>
                <Text style={[styles.fxCalcValue, { color: colors.foreground }]}>
                  {(
                    ((parseFloat(convertAmount) || 0) * (FX_RATES[fromCurrency] || 1)) /
                    (FX_RATES[toCurrency] || 1)
                  ).toFixed(2)}{" "}
                  {toCurrency}
                </Text>
              </View>

              <Pressable
                onPress={handleExecuteConversion}
                disabled={isConverting}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.foreground },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: colors.background }]}>
                  {isConverting ? "Converting..." : "Execute Conversion"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  fxSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniFxChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  fxCalcPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.md,
  },
  fxCalcLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  fxCalcValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    marginTop: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  successState: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  successSub: {
    fontSize: 13,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
