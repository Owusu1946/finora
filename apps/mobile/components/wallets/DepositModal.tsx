import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  Share,
  Platform,
} from "react-native";
import { Icon } from "@/components/ui/icon";
import { CurrencyIcon } from "@/components/ui/currency-icon";
import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import { haptics } from "@/lib/haptics";
import { WalletItem } from "./types";

interface DepositModalProps {
  visible: boolean;
  selectedWallet: WalletItem | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

export function DepositModal({
  visible,
  selectedWallet,
  onClose,
  onCopy,
}: DepositModalProps) {
  const { colors } = useTheme();

  const handleShareDetails = async (w: WalletItem) => {
    haptics.selection();
    const detailsStr = w.accountDetails?.iban
      ? `IBAN: ${w.accountDetails.iban}\nBank: ${w.accountDetails.bankName}\nBIC: ${w.accountDetails.swiftBic}`
      : w.accountDetails?.accountNumber
        ? `Account: ${w.accountDetails.accountNumber}\nRouting: ${w.accountDetails.routingNumber}\nBank: ${w.accountDetails.bankName}`
        : `Crypto Address (${w.accountDetails?.network}): ${w.accountDetails?.address}`;

    try {
      await Share.share({
        message: `Finora ${w.name} Details:\n${detailsStr}`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sheetHeader}>
            {selectedWallet && (
              <View style={styles.headerLeft}>
                <CurrencyIcon currency={selectedWallet.currency} size={32} />
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  {selectedWallet.name} Account
                </Text>
              </View>
            )}
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="remove" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {selectedWallet && (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Balance Summary Header */}
              <View
                style={[
                  styles.sheetBalanceBox,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Text style={[styles.sheetBalanceLabel, { color: colors.mutedForeground }]}>
                  Wallet Balance
                </Text>
                <Text style={[styles.sheetBalanceValue, { color: colors.foreground }]}>
                  {selectedWallet.symbol}
                  {selectedWallet.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {selectedWallet.currency}
                </Text>
              </View>

              {/* Account Details Breakdown */}
              {selectedWallet.accountDetails?.bankName && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Bank Partner
                  </Text>
                  <Text style={[styles.sheetRowValue, { color: colors.foreground }]}>
                    {selectedWallet.accountDetails.bankName}
                  </Text>
                </View>
              )}

              {selectedWallet.accountDetails?.accountName && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Beneficiary Name
                  </Text>
                  <Text style={[styles.sheetRowValue, { color: colors.foreground }]}>
                    {selectedWallet.accountDetails.accountName}
                  </Text>
                </View>
              )}

              {selectedWallet.accountDetails?.iban && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    IBAN
                  </Text>
                  <Pressable
                    style={styles.sheetCopyRow}
                    onPress={() => onCopy(selectedWallet.accountDetails!.iban!, "IBAN")}
                  >
                    <Text style={[styles.sheetRowValueMono, { color: colors.foreground }]}>
                      {selectedWallet.accountDetails.iban}
                    </Text>
                    <Icon name="copy" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}

              {selectedWallet.accountDetails?.accountNumber && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Account Number
                  </Text>
                  <Pressable
                    style={styles.sheetCopyRow}
                    onPress={() =>
                      onCopy(selectedWallet.accountDetails!.accountNumber!, "Account Number")
                    }
                  >
                    <Text style={[styles.sheetRowValueMono, { color: colors.foreground }]}>
                      {selectedWallet.accountDetails.accountNumber}
                    </Text>
                    <Icon name="copy" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}

              {selectedWallet.accountDetails?.routingNumber && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Routing / Sort Code
                  </Text>
                  <Text style={[styles.sheetRowValueMono, { color: colors.foreground }]}>
                    {selectedWallet.accountDetails.routingNumber}
                  </Text>
                </View>
              )}

              {selectedWallet.accountDetails?.address && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Deposit Address ({selectedWallet.accountDetails.network})
                  </Text>
                  <Pressable
                    style={styles.sheetCopyRow}
                    onPress={() =>
                      onCopy(selectedWallet.accountDetails!.address!, "Crypto Address")
                    }
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.sheetRowValueMono,
                        { color: colors.foreground, flex: 1 },
                      ]}
                    >
                      {selectedWallet.accountDetails.address}
                    </Text>
                    <Icon name="copy" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}

              {selectedWallet.accountDetails?.phone && (
                <View style={styles.sheetRow}>
                  <Text style={[styles.sheetRowLabel, { color: colors.mutedForeground }]}>
                    Mobile Money Number
                  </Text>
                  <Pressable
                    style={styles.sheetCopyRow}
                    onPress={() =>
                      onCopy(selectedWallet.accountDetails!.phone!, "MoMo Line")
                    }
                  >
                    <Text style={[styles.sheetRowValueMono, { color: colors.foreground }]}>
                      {selectedWallet.accountDetails.phone}
                    </Text>
                    <Icon name="copy" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}

              {/* Share Action */}
              <Pressable
                onPress={() => handleShareDetails(selectedWallet)}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.muted },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="share" size={15} color={colors.foreground} />
                <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>
                  Share Receiving Details
                </Text>
              </Pressable>
            </ScrollView>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sheetBalanceBox: {
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 12,
  },
  sheetBalanceLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  sheetBalanceValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  sheetRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150,150,150,0.12)",
    gap: 4,
  },
  sheetRowLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sheetRowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  sheetRowValueMono: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "500",
  },
  sheetCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  pressed: {
    opacity: 0.8,
  },
});
