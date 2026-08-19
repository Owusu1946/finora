import Svg, { Path } from 'react-native-svg';

type GoogleDriveLogoProps = {
  width?: number;
  height?: number;
};

export function GoogleDriveLogo({ width = 22, height }: GoogleDriveLogoProps) {
  const size = height ?? width;
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 48 48'
      accessibilityRole='image'
      accessibilityLabel='Google Drive'
    >
      <Path
        fill='#FFC107'
        d='M17 6L31 6 45 30 31 30z'
      />
      <Path
        fill='#1976D2'
        d='M9.875 42L16.938 30 45 30 38 42z'
      />
      <Path
        fill='#4CAF50'
        d='M3 30.125L9.875 42 24 18 17 6z'
      />
    </Svg>
  );
}
