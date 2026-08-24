import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText as Text } from '@/components/ui/text';

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

/**
 * Fiat currency → ISO 3166-1 alpha-2 (flagcdn).
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

/** flagcdn w* assets are 4:3 — never force into a square or they stretch. */
const FLAG_ASPECT = 4 / 3;

/** ISO country/region code for a fiat currency, if mapped. */
export function currencyCountryCode(currency: string): string | undefined {
  return CURRENCY_ISO[currency.toUpperCase()];
}

/**
 * Tether (USDT) mark.
 * Source: cryptocurrency-icons (spothq) — brand green #26A17B.
 */
function UsdtIcon({ size }: { size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      accessibilityRole='image'
      accessibilityLabel='USDT'
    >
      <Circle
        cx='16'
        cy='16'
        r='16'
        fill='#26A17B'
      />
      <Path
        fill='#FFF'
        d='M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117'
      />
    </Svg>
  );
}

/**
 * USD Coin (USDC) mark.
 * Source: Circle / Wikimedia Commons — Circle_USDC_Logo.svg (#0B53BF).
 */
function UsdcIcon({ size }: { size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 96 96'
      accessibilityRole='image'
      accessibilityLabel='USDC'
    >
      <Path
        d='M48 95C73.9574 95 95 73.9574 95 48C95 22.0426 73.9574 1 48 1C22.0426 1 1 22.0426 1 48C1 73.9574 22.0426 95 48 95Z'
        fill='#0B53BF'
      />
      <Path
        d='M56.4609 13.7778V19.8291C68.5341 23.4716 77.3759 34.6928 77.3759 47.9997C77.3759 61.3066 68.5341 72.5278 56.4609 76.1703V82.2216C71.8534 78.4616 83.2509 64.5672 83.2509 47.9997C83.2509 31.4322 71.8534 17.5378 56.4609 13.7778Z'
        fill='#FFF'
      />
      <Path
        d='M18.625 47.9997C18.625 34.6928 27.4669 23.4716 39.54 19.8291V13.7778C24.1475 17.5378 12.75 31.4322 12.75 47.9997C12.75 64.5672 24.1475 78.4616 39.54 82.2216V76.1703C27.4669 72.5572 18.625 61.3066 18.625 47.9997Z'
        fill='#FFF'
      />
      <Path
        d='M60.6319 54.5506C60.6319 42.5362 41.8025 47.4713 41.8025 40.8325C41.8025 38.4531 43.7119 36.9256 47.3544 36.9256C51.7019 36.9256 53.2 39.0406 53.67 41.89H59.6625C59.1279 36.5426 56.0588 33.1662 50.9382 32.1604V27.4375H45.0632V31.9918C39.4534 32.7062 35.9275 35.973 35.9275 40.8325C35.9275 52.9056 54.7863 48.3819 54.7863 54.9031C54.7863 57.3706 52.4069 59.0156 48.3825 59.0156C43.1244 59.0156 41.3913 56.695 40.745 53.4931H34.8994C35.2781 59.3502 38.8897 63.0159 45.0632 63.9307V68.5625H50.9382V63.9923C56.9633 63.2139 60.6319 59.7089 60.6319 54.5506Z'
        fill='#FFF'
      />
    </Svg>
  );
}

function FiatFlagIcon({ iso, size }: { iso: string; size: number }) {
  // Slightly oversize so a 4:3 flag fills the circular crop without stretching.
  const flagHeight = size * 1.2;
  const flagWidth = flagHeight * FLAG_ASPECT;

  return (
    <View
      className='items-center justify-center overflow-hidden bg-[#e4e4e7]'
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Image
        source={{ uri: `https://flagcdn.com/w160/${iso}.png` }}
        style={{
          width: flagWidth,
          height: flagHeight,
        }}
        contentFit='cover'
        accessibilityLabel={`${iso.toUpperCase()} flag`}
      />
    </View>
  );
}

export function CurrencyIcon({ currency, size = 36 }: CurrencyIconProps) {
  const code = currency.toUpperCase();

  if (code === 'USDT') {
    return <UsdtIcon size={size} />;
  }

  if (code === 'USDC') {
    return <UsdcIcon size={size} />;
  }

  const iso = CURRENCY_ISO[code];
  if (iso) {
    return (
      <FiatFlagIcon
        iso={iso}
        size={size}
      />
    );
  }

  return (
    <View
      className='items-center justify-center'
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: FALLBACK.bg }}
    >
      <Text
        className='font-bold tracking-[-0.5px]'
        style={{ color: FALLBACK.text, fontSize: size * 0.36 }}
      >
        {code.slice(0, 2)}
      </Text>
    </View>
  );
}
