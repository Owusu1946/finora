import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  size?: number;
  /**
   * `badge` — dark disc with metal mark (lists, QR centers).
   * `bare` — mark only, no background.
   */
  variant?: 'badge' | 'bare';
  /**
   * `light` — dark mark for light backgrounds.
   * `dark` — light metal mark for dark backgrounds.
   * `metal` / `ink` — legacy aliases for card art.
   */
  tone?: 'light' | 'dark' | 'metal' | 'ink';
  compact?: boolean;
};

/** Maps app theme to bare mark tone (no background). */
export function finoraToneForTheme(isDark: boolean): 'light' | 'dark' {
  return isDark ? 'dark' : 'light';
}

/**
 * Official Finora mark from the virtual card art:
 * dual crescent arcs + center node.
 */
export function FinoraMark({
  size,
  variant = 'badge',
  tone = 'metal',
  compact,
}: Props) {
  const markSize = size ?? (compact ? 22 : 30);
  const resolved = resolveTone(tone);

  if (variant === 'bare') {
    return (
      <FinoraMarkSvg
        size={markSize}
        tone={resolved}
      />
    );
  }

  return (
    <View
      style={{
        width: markSize,
        height: markSize,
        borderRadius: markSize / 2,
        backgroundColor: '#18181b',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole='image'
      accessibilityLabel='Finora'
    >
      <FinoraMarkSvg
        size={markSize * 0.72}
        tone='dark'
      />
    </View>
  );
}

/** Bare logo that follows the active light / dark theme. */
export function FinoraLogo({ size = 44 }: { size?: number }) {
  const { isDark } = useTheme();
  return (
    <FinoraMark
      variant='bare'
      size={size}
      tone={finoraToneForTheme(isDark)}
    />
  );
}

function resolveTone(tone: Props['tone']): 'light' | 'dark' {
  if (tone === 'light' || tone === 'ink') return 'light';
  if (tone === 'dark' || tone === 'metal') return 'dark';
  return 'light';
}

function FinoraMarkSvg({ size, tone }: { size: number; tone: 'light' | 'dark' }) {
  const gradId = `finoraMetal-${tone}-${size}`;
  const isDarkMark = tone === 'dark';

  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 34 34'
      accessibilityRole='image'
      accessibilityLabel='Finora'
    >
      {isDarkMark ? (
        <Defs>
          <SvgLinearGradient
            id={gradId}
            x1='0'
            y1='0'
            x2='1'
            y2='1'
          >
            <Stop
              offset='0'
              stopColor='#ffffff'
            />
            <Stop
              offset='1'
              stopColor='#9da3a0'
            />
          </SvgLinearGradient>
        </Defs>
      ) : null}
      <Path
        d='M11.4 5.8C7.7 7.3 5.2 10.9 5.2 15s2.5 7.7 6.2 9.2l2.7-4.1c-2.2-.8-3.7-2.8-3.7-5.1s1.5-4.3 3.7-5.1z'
        fill={isDarkMark ? `url(#${gradId})` : '#18181b'}
      />
      <Path
        d='M22.6 28.2c3.7-1.5 6.2-5.1 6.2-9.2s-2.5-7.7-6.2-9.2l-2.7 4.1c2.2.8 3.7 2.8 3.7 5.1s-1.5 4.3-3.7 5.1z'
        fill={isDarkMark ? `url(#${gradId})` : '#18181b'}
      />
      <Circle
        cx='17'
        cy='17'
        r='2.8'
        fill={isDarkMark ? '#f5f7f6' : '#18181b'}
      />
    </Svg>
  );
}
