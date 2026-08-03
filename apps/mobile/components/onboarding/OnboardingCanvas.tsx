import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  Extrapolation,
  type SharedValue,
  useDerivedValue,
  interpolate,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

import { AccountSplitDiscs } from './AccountSplitDiscs';
import { LiquidGlassRing } from './LiquidGlassRing';
import { MessageBubbleMotif } from './MessageBubbleMotif';

type OnboardingCanvasProps = {
  progress: SharedValue<number>;
  /** 0 = none, 1 = personal, 2 = business */
  accountSelection: SharedValue<number>;
  colors: Palette;
  isDark: boolean;
  /** Vertical center of the hero stage (screen coords). */
  heroCenterY: number;
};

export function OnboardingCanvas({
  progress,
  accountSelection,
  colors,
  isDark,
  heroCenterY,
}: OnboardingCanvasProps) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();
  const cx = width / 2;
  const cy = heroCenterY;
  const ringR = Math.min(width * 0.28, 110);

  const orb1Cx = useDerivedValue(() => {
    return cx + interpolate(progress.value, [0, 1, 2, 3], [-36, 18, -8, 24]);
  });
  const orb1Cy = useDerivedValue(() => {
    return cy + interpolate(progress.value, [0, 1, 2, 3], [-12, 8, 4, -10]);
  });
  const orb1R = useDerivedValue(() => {
    return interpolate(progress.value, [0, 1, 2, 3], [72, 80, 64, 70]);
  });

  const orb2Cx = useDerivedValue(() => {
    return cx + interpolate(progress.value, [0, 1, 2, 3], [42, -24, 32, -16]);
  });
  const orb2Cy = useDerivedValue(() => {
    return cy + interpolate(progress.value, [0, 1, 2, 3], [28, 36, -6, 22]);
  });
  const orb2R = useDerivedValue(() => {
    return interpolate(progress.value, [0, 1, 2, 3], [54, 48, 58, 50]);
  });

  const orb3Cx = useDerivedValue(() => {
    return cx + interpolate(progress.value, [0, 1, 2, 3], [-8, 30, -28, 8]);
  });
  const orb3Cy = useDerivedValue(() => {
    return cy + interpolate(progress.value, [0, 1, 2, 3], [40, -18, 30, 14]);
  });
  const orb3R = useDerivedValue(() => {
    return interpolate(progress.value, [0, 1, 2, 3], [40, 44, 36, 46]);
  });

  const orbOpacity = useDerivedValue(() => {
    return interpolate(
      progress.value,
      [0, 0.5, 0.9, 1.2, 1.5, 2, 2.5, 3],
      [0.4, 0.48, 0.28, 0.22, 0.32, 0.14, 0.22, 0.12],
      Extrapolation.CLAMP,
    );
  });

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      pointerEvents='none'
    >
      <Fill>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={[colors.background, colors.muted, colors.background]}
        />
      </Fill>

      <Group opacity={orbOpacity}>
        <Circle
          cx={orb1Cx}
          cy={orb1Cy}
          r={orb1R}
          color={colors.ring}
        >
          <BlurMask
            blur={36}
            style='normal'
          />
        </Circle>
        <Circle
          cx={orb2Cx}
          cy={orb2Cy}
          r={orb2R}
          color={colors.mutedForeground}
        >
          <BlurMask
            blur={32}
            style='normal'
          />
        </Circle>
        <Circle
          cx={orb3Cx}
          cy={orb3Cy}
          r={orb3R}
          color={colors.border}
        >
          <BlurMask
            blur={24}
            style='normal'
          />
        </Circle>
      </Group>

      <MessageBubbleMotif
        progress={progress}
        cx={cx}
        cy={cy}
        colors={colors}
        isDark={isDark}
      />

      <LiquidGlassRing
        progress={progress}
        clock={clock}
        cx={cx}
        cy={cy}
        r={ringR}
        colors={colors}
        isDark={isDark}
      />

      <AccountSplitDiscs
        progress={progress}
        selection={accountSelection}
        cx={cx}
        cy={cy}
        colors={colors}
        isDark={isDark}
      />
    </Canvas>
  );
}
