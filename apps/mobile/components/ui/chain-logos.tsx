import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type LogoProps = {
  size?: number;
};

/** Base network mark — blue disc with inset square (Base brand). */
export function BaseLogo({ size = 32 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      accessibilityRole='image'
      accessibilityLabel='BASE'
    >
      <Circle
        cx='16'
        cy='16'
        r='16'
        fill='#0052FF'
      />
      <Rect
        x='11'
        y='11'
        width='10'
        height='10'
        rx='1.5'
        fill='#FFFFFF'
      />
    </Svg>
  );
}

/**
 * Ethereum mark.
 * Source: cryptocurrency-icons (spothq) — #627EEA.
 */
export function EthereumLogo({ size = 32 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      accessibilityRole='image'
      accessibilityLabel='Ethereum'
    >
      <Circle
        cx='16'
        cy='16'
        r='16'
        fill='#627EEA'
      />
      <G fill='#FFF'>
        <Path
          fillOpacity='0.602'
          d='M16.498 4v8.87l7.497 3.35z'
        />
        <Path d='M16.498 4L9 16.22l7.498-3.35z' />
        <Path
          fillOpacity='0.602'
          d='M16.498 21.968v6.027L24 17.616z'
        />
        <Path d='M16.498 27.995v-6.028L9 17.616z' />
        <Path
          fillOpacity='0.2'
          d='M16.498 20.573l7.497-4.353-7.497-3.348z'
        />
        <Path
          fillOpacity='0.602'
          d='M9 16.22l7.498 4.353v-7.701z'
        />
      </G>
    </Svg>
  );
}

/**
 * Solana mark.
 * Source: cryptocurrency-icons (spothq).
 */
export function SolanaLogo({ size = 32 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      accessibilityRole='image'
      accessibilityLabel='Solana'
    >
      <Circle
        cx='16'
        cy='16'
        r='16'
        fill='#000000'
      />
      <Path
        d='M9.925 19.687a.59.59 0 01.415-.17h14.366a.29.29 0 01.207.497l-2.838 2.815a.59.59 0 01-.415.171H7.294a.291.291 0 01-.207-.498l2.838-2.815zm0-10.517A.59.59 0 0110.34 9h14.366c.261 0 .392.314.207.498l-2.838 2.815a.59.59 0 01-.415.17H7.294a.291.291 0 01-.207-.497L9.925 9.17zm12.15 5.225a.59.59 0 00-.415-.17H7.294a.291.291 0 00-.207.498l2.838 2.815c.11.109.26.17.415.17h14.366a.291.291 0 00.207-.498l-2.838-2.815z'
        fill='#FFFFFF'
      />
    </Svg>
  );
}

/**
 * TRON mark.
 * Source: cryptocurrency-icons (spothq) — #EF0027.
 */
export function TronLogo({ size = 32 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      accessibilityRole='image'
      accessibilityLabel='TRON'
    >
      <Circle
        cx='16'
        cy='16'
        r='16'
        fill='#EF0027'
      />
      <Path
        d='M21.932 9.913L7.5 7.257l7.595 19.112 10.583-12.894-3.746-3.562zm-.232 1.17l2.208 2.099-6.038 1.093 3.83-3.192zm-5.142 2.973l-6.364-5.278 10.402 1.914-4.038 3.364zm-.453.934l-1.038 8.58L9.472 9.487l6.633 5.502zm.96.455l6.687-1.21-7.67 9.343.983-8.133z'
        fill='#FFFFFF'
      />
    </Svg>
  );
}
