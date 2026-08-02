import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

export type SupportedCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "USDT"
  | "USDC"
  | "GHS"
  | "NGN"
  | "CAD"
  | "KES";

interface CurrencyIconProps {
  currency: SupportedCurrency | string;
  size?: number;
}

const SVG_ICONS: Partial<Record<SupportedCurrency, string>> = {
  USDT: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%2326A17B"/><path fill="%23FFF" d="M116.5 106.5c-1.3.1-6.1.3-16.5.3-8.8 0-14.8-.2-16.5-.3-3.3-.2-26.6-1.4-26.6-16.8 0-16.6 26.4-16.8 26.9-16.8h65.3v-23.9H94.1V25H68.8v23.9H31.5v23.9H94v.1c.5 0 26.9.2 26.9 16.8.1 15.4-23.1 16.6-26.4 16.8zm-16.5 13.9c-27.1 0-49.3-5-49.3-11.2v27c0 6.2 22.2 11.2 49.3 11.2s49.3-5 49.3-11.2v-27c0 6.2-22.2 11.2-49.3 11.2z"/></svg>`,
  USDC: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%232775CA"/><path fill="%23FFF" d="M100 20c-44.2 0-80 35.8-80 80s35.8 80 80 80 80-35.8 80-80-35.8-80-80-80zm0 144c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zm12-84c-4-2-9.7-3.5-16.5-3.5-13.1 0-21 7-21 16.5 0 9.2 6.9 13.8 21 17.8 16.5 4.6 24.5 11.5 24.5 24.6 0 16-13.1 24.6-30.8 24.6-9.1 0-17.7-2.3-22.8-5.1l4-13.7c4.6 2.9 11.4 5.1 18.8 5.1 13.1 0 19.4-5.7 19.4-14.3 0-8.6-6.3-13.1-20.5-17.2-16.5-4.8-23.4-11.1-23.4-23.7 0-14.3 12-23.4 28.5-23.4 8 0 15.4 1.7 20 4l-4 13.5z"/></svg>`,
};

const CURRENCY_CONFIG: Record<
  string,
  { bg: string; text: string; symbol: string }
> = {
  USD: { bg: "#10B981", text: "#FFFFFF", symbol: "$" },
  EUR: { bg: "#4F46E5", text: "#FFFFFF", symbol: "€" },
  GBP: { bg: "#7C3AED", text: "#FFFFFF", symbol: "£" },
  GHS: { bg: "#D97706", text: "#FFFFFF", symbol: "₵" },
  NGN: { bg: "#059669", text: "#FFFFFF", symbol: "₦" },
  CAD: { bg: "#DC2626", text: "#FFFFFF", symbol: "C$" },
  KES: { bg: "#2563EB", text: "#FFFFFF", symbol: "KSh" },
};

export function CurrencyIcon({ currency, size = 36 }: CurrencyIconProps) {
  const code = currency.toUpperCase() as SupportedCurrency;

  if (SVG_ICONS[code]) {
    return (
      <Image
        source={{ uri: SVG_ICONS[code] }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  const config = CURRENCY_CONFIG[code] || {
    bg: "#6B7280",
    text: "#FFFFFF",
    symbol: code.substring(0, 2),
  };

  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: config.bg,
        },
      ]}
    >
      <Text style={[styles.symbolText, { color: config.text, fontSize: size * 0.42 }]}>
        {config.symbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  symbolText: {
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
