import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { haptics } from "@/lib/haptics";

interface WalletHeaderProps {
  accountLabel: string;
  totalNetWorthUSD: number;
  hideBalances: boolean;
  onToggleHideBalances: () => void;
  onOpenSend: () => void;
  onOpenDeposit: () => void;
  onOpenConvert: () => void;
}

export function WalletHeader({
  accountLabel,
  totalNetWorthUSD,
  hideBalances,
  onToggleHideBalances,
  onOpenSend,
  onOpenDeposit,
  onOpenConvert,
}: WalletHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.headerSection}>
      <View style={styles.topMetaRow}>
        <Text style={[styles.accountLabelText, { color: colors.mutedForeground }]}>
          {accountLabel} Net Worth
        </Text>

        <Pressable
          hitSlop={8}
          onPress={() => {
            haptics.selection();
            onToggleHideBalances();
          }}
          style={styles.eyeBtn}
        >
          <Icon name={hideBalances ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text style={[styles.balanceDisplay, { color: colors.foreground }]}>
        {hideBalances
          ? "••••••••"
          : `$${totalNetWorthUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
      </Text>

      {/* Minimal Quick Actions Row */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenSend();
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.foreground },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrow-up" size={15} color={colors.background} />
          <Text style={[styles.actionBtnText, { color: colors.background }]}>Payout</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenDeposit();
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.muted, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrow-down-left" size={15} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Deposit</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenConvert();
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.muted, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="swap" size={15} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Convert</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    gap: 6,
    paddingTop: 4,
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountLabelText: {
    fontSize: 13,
    fontWeight: "500",
  },
  eyeBtn: {
    padding: 4,
  },
  balanceDisplay: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
