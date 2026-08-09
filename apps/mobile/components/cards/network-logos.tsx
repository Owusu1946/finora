import Svg, { Path } from 'react-native-svg';

type LogoProps = {
  width?: number;
  height?: number;
};

/**
 * Visa Brand Mark (2021–present).
 * Path from official Visa wordmark (visa.com / Wikimedia Commons).
 * White reverse for dark card faces per Visa brand standards.
 */
export function VisaLogo({ width = 52, height }: LogoProps) {
  const h = height ?? width * (324.68 / 1000);
  return (
    <Svg
      width={width}
      height={h}
      viewBox='0 0 1000 324.68'
      accessibilityRole='image'
      accessibilityLabel='Visa'
    >
      <Path
        fill='#FFFFFF'
        d='m651.19.5c-70.93,0-134.32,36.77-134.32,104.69,0,77.9,112.42,83.28,112.42,122.42,0,16.48-18.88,31.23-51.14,31.23-45.77,0-79.98-20.61-79.98-20.61l-14.64,68.55s39.41,17.41,91.73,17.41c77.55,0,138.58-38.57,138.58-107.66,0-82.32-112.89-87.54-112.89-123.86,0-12.91,15.5-27.05,47.66-27.05,36.29,0,65.89,14.99,65.89,14.99l14.33-66.2S696.61.5,651.18.5h0ZM2.22,5.5L.5,15.49s29.84,5.46,56.72,16.36c34.61,12.49,37.07,19.77,42.9,42.35l63.51,244.83h85.14L379.93,5.5h-84.94l-84.28,213.17-34.39-180.7c-3.15-20.68-19.13-32.48-38.68-32.48,0,0-135.41,0-135.41,0Zm411.87,0l-66.63,313.53h81L494.85,5.5h-80.76Zm451.76,0c-19.53,0-29.88,10.46-37.47,28.73l-118.67,284.8h84.94l16.43-47.47h103.48l9.99,47.47h74.95L934.12,5.5h-68.27Zm11.05,84.71l25.18,117.65h-67.45l42.28-117.65h0Z'
      />
    </Svg>
  );
}

/**
 * Mastercard Symbol (interlocking circles).
 * Official brand colors from Mastercard Brand Center artwork.
 */
export function MastercardLogo({ width = 40, height }: LogoProps) {
  const h = height ?? width * (47.304 / 76.536);
  return (
    <Svg
      width={width}
      height={h}
      viewBox='21.732 16.348 76.536 47.304'
      accessibilityRole='image'
      accessibilityLabel='Mastercard'
    >
      <Path
        fill='#FF5F00'
        fillRule='evenodd'
        clipRule='evenodd'
        d='M49.6521 58.595H70.3479V21.4044H49.6521V58.595Z'
      />
      <Path
        fill='#F79E1B'
        fillRule='evenodd'
        clipRule='evenodd'
        d='M98.2675 40.0003C98.2675 53.063 87.6791 63.652 74.6171 63.652C69.0996 63.652 64.0229 61.7624 60 58.5956C65.5011 54.2646 69.0339 47.5448 69.0339 40.0003C69.0339 32.4552 65.5011 25.7354 60 21.4044C64.0229 18.2376 69.0996 16.348 74.6171 16.348C87.6791 16.348 98.2675 26.937 98.2675 40.0003Z'
      />
      <Path
        fill='#EB001B'
        fillRule='evenodd'
        clipRule='evenodd'
        d='M50.966 40.0003C50.966 32.4552 54.4988 25.7354 59.9999 21.4044C55.977 18.2376 50.9003 16.348 45.3828 16.348C32.3208 16.348 21.7324 26.937 21.7324 40.0003C21.7324 53.063 32.3208 63.652 45.3828 63.652C50.9003 63.652 55.977 61.7624 59.9999 58.5956C54.4988 54.2646 50.966 47.5448 50.966 40.0003Z'
      />
    </Svg>
  );
}
