import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Polygon } from 'react-native-svg';

type LogoProps = {
  size?: number;
};

const TELECEL_LOGO = require('@/assets/momo/telecel.png');
const AIRTELTIGO_LOGO = require('@/assets/momo/airteltigo.png');

/**
 * MTN brand mark (circular crop).
 * Source: Wikimedia Commons — MTN_Logo.svg (MTN Group).
 * Colors: yellow #FFCB05, blue #00678F, red #ED1D24.
 */
export function MtnLogo({ size = 32 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 200 200'
      accessibilityRole='image'
      accessibilityLabel='MTN'
    >
      <Circle
        cx='100'
        cy='100'
        r='100'
        fill='#FFCB05'
      />
      <Ellipse
        cx='100.01'
        cy='99.47'
        rx='84.61'
        ry='34.89'
        fill='#00678F'
      />
      <G fill='#FFFFFF'>
        <Polygon points='45.81,116.69 54.56,81.8 68.54,81.8 68.54,102.12 77.73,81.8 92.16,81.8 83.42,116.69 74.23,116.69 79.47,94.17 68.54,116.69 61.12,116.69 61.12,94.17 55.42,116.69' />
        <Polygon points='117.5,116.69 126.24,81.8 136.3,81.8 140.68,100.36 145.48,81.8 154.66,81.8 145.92,116.69 136.3,116.69 131.49,97.7 126.68,116.69' />
      </G>
      <Polygon
        fill='#ED1D24'
        points='94.99,117.13 96.3,112.27 106.36,112.27 105.04,117.13'
      />
      <Polygon
        fill='#FFCB05'
        points='94.99,81.8 92.8,90.64 101.99,90.64 97.04,109.81 107.09,109.81 112.05,90.64 121.23,90.64 123.41,81.8'
      />
    </Svg>
  );
}

/** Official Telecel app icon (red squircle + white “t”). */
export function TelecelLogo({ size = 32 }: LogoProps) {
  return (
    <Image
      source={TELECEL_LOGO}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
      }}
      contentFit='cover'
      accessibilityRole='image'
      accessibilityLabel='Telecel'
    />
  );
}

/** Official AT wordmark (AirtelTigo rebrand — red “a”, navy “t”, “life is simple”). */
export function AirtelTigoLogo({ size = 32 }: LogoProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole='image'
      accessibilityLabel='AT'
    >
      <Image
        source={AIRTELTIGO_LOGO}
        style={{
          width: size * 0.94,
          height: size * 0.94,
          marginTop: -size * 0.06,
        }}
        contentFit='contain'
        accessibilityLabel='AT'
      />
    </View>
  );
}
