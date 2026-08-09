import Svg, { Path } from 'react-native-svg';

type LogoProps = {
  width?: number;
  height?: number;
};

/**
 * Official Gmail icon (2020–present).
 * Source: Google / Wikimedia Commons — Gmail_icon_(2020).svg
 * https://commons.wikimedia.org/wiki/File:Gmail_icon_(2020).svg
 */
export function GmailLogo({ width = 22, height }: LogoProps) {
  const h = height ?? width * (66 / 88);
  return (
    <Svg
      width={width}
      height={h}
      viewBox='52 42 88 66'
      accessibilityRole='image'
      accessibilityLabel='Gmail'
    >
      <Path
        fill='#4285F4'
        d='M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6'
      />
      <Path
        fill='#34A853'
        d='M120 108h14c3.32 0 6-2.69 6-6V59l-20 15'
      />
      <Path
        fill='#FBBC04'
        d='M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2'
      />
      <Path
        fill='#EA4335'
        d='M72 74V48l24 18 24-18v26L96 92'
      />
      <Path
        fill='#C5221F'
        d='M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2'
      />
    </Svg>
  );
}
