import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import {
  FINORA_MARK_LEFT_CRESCENT,
  FINORA_MARK_NODE,
  FINORA_MARK_RIGHT_CRESCENT,
  FINORA_MARK_VIEWBOX,
} from './finora-mark-paths';

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
      viewBox={`0 0 ${FINORA_MARK_VIEWBOX} ${FINORA_MARK_VIEWBOX}`}
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
        d={FINORA_MARK_LEFT_CRESCENT}
        fill={isDarkMark ? `url(#${gradId})` : '#18181b'}
      />
      <Path
        d={FINORA_MARK_RIGHT_CRESCENT}
        fill={isDarkMark ? `url(#${gradId})` : '#18181b'}
      />
      <Circle
        cx={FINORA_MARK_NODE.cx}
        cy={FINORA_MARK_NODE.cy}
        r={FINORA_MARK_NODE.r}
        fill={isDarkMark ? '#f5f7f6' : '#18181b'}
      />
    </Svg>
  );
}
