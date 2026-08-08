import { AppText as Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import CountryFlag from 'react-native-country-flag';

export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'USDT'
  | 'USDC'
  | 'GHS'
  | 'NGN'
  | 'CAD'
  | 'KES'
  | 'UGX'
  | 'TZS'
  | 'ZAR'
  | 'AED'
  | 'INR'
  | 'JPY'
  | 'CNH';

interface CurrencyIconProps {
  currency: SupportedCurrency | string;
  size?: number;
}

/** Stablecoin brand marks (not country-tied). */
const SVG_ICONS: Partial<Record<string, string>> = {
  USDT: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%2326A17B"/><path fill="%23FFF" d="M116.5 106.5c-1.3.1-6.1.3-16.5.3-8.8 0-14.8-.2-16.5-.3-3.3-.2-26.6-1.4-26.6-16.8 0-16.6 26.4-16.8 26.9-16.8h65.3v-23.9H94.1V25H68.8v23.9H31.5v23.9H94v.1c.5 0 26.9.2 26.9 16.8.1 15.4-23.1 16.6-26.4 16.8zm-16.5 13.9c-27.1 0-49.3-5-49.3-11.2v27c0 6.2 22.2 11.2 49.3 11.2s49.3-5 49.3-11.2v-27c0 6.2-22.2 11.2-49.3 11.2z"/></svg>`,
  USDC: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%232775CA"/><path fill="%23FFF" d="M100 20c-44.2 0-80 35.8-80 80s35.8 80 80 80 80-35.8 80-80-35.8-80-80-80zm0 144c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zm12-84c-4-2-9.7-3.5-16.5-3.5-13.1 0-21 7-21 16.5 0 9.2 6.9 13.8 21 17.8 16.5 4.6 24.5 11.5 24.5 24.6 0 16-13.1 24.6-30.8 24.6-9.1 0-17.7-2.3-22.8-5.1l4-13.7c4.6 2.9 11.4 5.1 18.8 5.1 13.1 0 19.4-5.7 19.4-14.3 0-8.6-6.3-13.1-20.5-17.2-16.5-4.8-23.4-11.1-23.4-23.7 0-14.3 12-23.4 28.5-23.4 8 0 15.4 1.7 20 4l-4 13.5z"/></svg>`,
};

/**
 * Fiat currency → ISO 3166-1 alpha-2 (for react-native-country-flag / flagcdn).
 * EUR uses the EU regional code.
 */
const CURRENCY_ISO: Record<string, string> = {
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  GHS: 'gh',
  NGN: 'ng',
  CAD: 'ca',
  KES: 'ke',
  UGX: 'ug',
  TZS: 'tz',
  ZAR: 'za',
  AED: 'ae',
  INR: 'in',
  JPY: 'jp',
  CNH: 'cn',
  CNY: 'cn',
  XOF: 'sn',
  XAF: 'cm',
};

const FALLBACK = { bg: '#6B7280', text: '#FFFFFF' };

/** ISO country/region code for a fiat currency, if mapped. */
export function currencyCountryCode(currency: string): string | undefined {
  return CURRENCY_ISO[currency.toUpperCase()];
}

export function CurrencyIcon({ currency, size = 36 }: CurrencyIconProps) {
  const code = currency.toUpperCase();

  if (SVG_ICONS[code]) {
    return (
      <Image
        source={{ uri: SVG_ICONS[code] }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit='cover'
      />
    );
  }

  const iso = CURRENCY_ISO[code];
  if (iso) {
    return (
      <View
        style={[
          styles.flagAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <CountryFlag
          isoCode={iso}
          size={size}
          style={styles.flagImage}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: FALLBACK.bg,
        },
      ]}
    >
      <Text style={[styles.symbolText, { color: FALLBACK.text, fontSize: size * 0.36 }]}>
        {code.slice(0, 2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flagAvatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e4e4e7',
  },
  /** Widen past the circle so a 3:2 flag fills the circular crop. */
  flagImage: {
    transform: [{ scale: 1.35 }],
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
