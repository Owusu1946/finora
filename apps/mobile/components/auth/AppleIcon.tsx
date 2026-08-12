import Svg, { Path } from 'react-native-svg';

type AppleIconProps = {
  size?: number;
  color: string;
};

export function AppleIcon({ size = 20, color }: AppleIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      accessibilityRole='image'
      accessibilityLabel='Apple'
    >
      <Path
        fill={color}
        d='M16.37 12.18c.02-2.02 1.65-2.99 1.72-3.04a3.68 3.68 0 0 0-2.9-1.57c-1.22-.13-2.41.73-3.03.73-.63 0-1.58-.72-2.61-.7a3.84 3.84 0 0 0-3.23 1.97c-1.4 2.42-.36 5.98.98 7.94.67.96 1.45 2.03 2.48 1.99 1.01-.04 1.39-.64 2.61-.64 1.21 0 1.56.64 2.62.62 1.09-.02 1.77-.96 2.41-1.93a7.93 7.93 0 0 0 1.1-2.24 3.49 3.49 0 0 1-2.15-3.13ZM14.39 6.28a3.54 3.54 0 0 0 .81-2.54 3.59 3.59 0 0 0-2.34 1.21 3.39 3.39 0 0 0-.83 2.45 2.96 2.96 0 0 0 2.36-1.12Z'
      />
    </Svg>
  );
}
