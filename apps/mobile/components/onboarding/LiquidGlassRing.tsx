import {
  BlurMask,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import {
  Extrapolation,
  type SharedValue,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

type LiquidGlassRingProps = {
  progress: SharedValue<number>;
  clock: SharedValue<number>;
  cx: number;
  cy: number;
  r: number;
  colors: Palette;
  /** True when theme is dark — tunes glass fill contrast. */
  isDark: boolean;
};

export function LiquidGlassRing({
  progress,
  clock,
  cx,
  cy,
  r,
  colors,
  isDark,
}: LiquidGlassRingProps) {
  const ringPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(cx, cy, r);
    return path;
  }, [cx, cy, r]);

  const innerPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(cx, cy, r * 0.82);
    return path;
  }, [cx, cy, r]);

  const opacity = useDerivedValue(() => {
    return interpolate(
      progress.value,
      [1.2, 1.65, 2.35, 2.85],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
  });

  const discOpacity = useDerivedValue(() => {
    return interpolate(
      progress.value,
      [1.25, 1.75, 2.3, 2.8],
      [0, 0.95, 0.95, 0],
      Extrapolation.CLAMP,
    );
  });

  const ringEnd = useDerivedValue(() => {
    return interpolate(progress.value, [1.35, 2, 2.4], [0, 1, 1], Extrapolation.CLAMP);
  });

  // Slow specular rotation (radians → transform)
  const highlightTransform = useDerivedValue(() => {
    const angle = (clock.value / 1000) * 0.35;
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: angle },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  const glassCore = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)';
  const glassEdge = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(244,244,245,0.25)';
  const glassSheen = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)';
  const glassSheenFade = isDark ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,0)';

  return (
    <Group opacity={opacity}>
      {/* Soft outer bloom */}
      <Group opacity={discOpacity}>
        <Circle
          cx={cx}
          cy={cy}
          r={r * 1.12}
          color={colors.foreground}
          opacity={isDark ? 0.06 : 0.04}
        >
          <BlurMask
            blur={28}
            style='normal'
          />
        </Circle>

        {/* Frosted disc body */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
        >
          <RadialGradient
            c={vec(cx - r * 0.25, cy - r * 0.3)}
            r={r * 1.15}
            colors={[glassCore, glassEdge]}
          />
          <BlurMask
            blur={1.5}
            style='normal'
          />
        </Circle>

        {/* Top-left specular wash */}
        <Group
          transform={highlightTransform}
          opacity={0.55}
        >
          <Circle
            cx={cx}
            cy={cy}
            r={r * 0.92}
          >
            <SweepGradient
              c={vec(cx, cy)}
              colors={[glassSheenFade, glassSheen, glassSheenFade, glassSheenFade]}
              start={0}
              end={360}
            />
          </Circle>
        </Group>

        {/* Thin glass rim */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          style='stroke'
          strokeWidth={1.25}
          color={colors.foreground}
          opacity={isDark ? 0.35 : 0.18}
        />

        {/* Inner depth rim */}
        <Path
          path={innerPath}
          style='stroke'
          strokeWidth={1}
          color={colors.foreground}
          opacity={isDark ? 0.12 : 0.08}
        />

        {/* Diagonal light streak */}
        <Circle
          cx={cx}
          cy={cy}
          r={r * 0.88}
          opacity={0.22}
        >
          <LinearGradient
            start={vec(cx - r, cy - r)}
            end={vec(cx + r * 0.4, cy + r * 0.6)}
            colors={[glassSheen, glassSheenFade, glassSheenFade]}
          />
        </Circle>
      </Group>

      {/* Approval progress ring (draws on) */}
      <Path
        path={ringPath}
        style='stroke'
        strokeWidth={2.5}
        strokeCap='round'
        color={colors.foreground}
        start={0}
        end={ringEnd}
        opacity={isDark ? 0.95 : 0.85}
      />
      <Path
        path={ringPath}
        style='stroke'
        strokeWidth={14}
        strokeCap='round'
        color={colors.foreground}
        opacity={0.12}
        start={0}
        end={ringEnd}
      >
        <BlurMask
          blur={12}
          style='solid'
        />
      </Path>
    </Group>
  );
}
