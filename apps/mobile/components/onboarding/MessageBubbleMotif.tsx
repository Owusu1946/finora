import { BlurMask, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  Extrapolation,
  type SharedValue,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

type MessageBubbleMotifProps = {
  progress: SharedValue<number>;
  cx: number;
  cy: number;
  colors: Palette;
  isDark: boolean;
};

/** Chat-bubble outline that draws in on mount and fades toward Beat 2. */
export function MessageBubbleMotif({ progress, cx, cy, colors, isDark }: MessageBubbleMotifProps) {
  const w = 150;
  const h = 88;
  const x = cx - w / 2;
  const y = cy - h / 2 - 6;

  const bubblePath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), 22, 22));
    // Tail
    path.moveTo(x + 28, y + h);
    path.quadTo(x + 22, y + h + 18, x + 8, y + h + 22);
    path.quadTo(x + 34, y + h + 14, x + 42, y + h);
    path.close();
    return path;
  }, [x, y, w, h]);

  // Draws in once on mount, then rides the swipe out toward Beat 2
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) });
  }, [reveal]);

  const exit = useDerivedValue(() =>
    interpolate(progress.value, [1.15, 1.55], [1, 0], Extrapolation.CLAMP),
  );

  const opacity = useDerivedValue(() => reveal.value * exit.value);

  const trimEnd = useDerivedValue(() => reveal.value);

  const fillOpacity = useDerivedValue(
    () => interpolate(reveal.value, [0.7, 1], [0, 0.14]) * exit.value,
  );

  // Secondary “reply” capsule
  const replyOpacity = useDerivedValue(
    () => interpolate(reveal.value, [0.85, 1], [0, 0.7]) * exit.value,
  );

  return (
    <Group opacity={opacity}>
      <Group opacity={fillOpacity}>
        <Path
          path={bubblePath}
          color={colors.foreground}
        >
          <BlurMask
            blur={0.5}
            style='normal'
          />
        </Path>
      </Group>

      <Path
        path={bubblePath}
        style='stroke'
        strokeWidth={2}
        strokeCap='round'
        strokeJoin='round'
        color={colors.foreground}
        start={0}
        end={trimEnd}
        opacity={isDark ? 0.9 : 0.75}
      />
      <Path
        path={bubblePath}
        style='stroke'
        strokeWidth={10}
        strokeCap='round'
        strokeJoin='round'
        color={colors.foreground}
        opacity={0.1}
        start={0}
        end={trimEnd}
      >
        <BlurMask
          blur={8}
          style='solid'
        />
      </Path>

      <Group opacity={replyOpacity}>
        <RoundedRect
          x={cx - 28}
          y={cy + 42}
          width={78}
          height={28}
          r={14}
          color={colors.mutedForeground}
          opacity={isDark ? 0.25 : 0.2}
        />
        <RoundedRect
          x={cx - 28}
          y={cy + 42}
          width={78}
          height={28}
          r={14}
          style='stroke'
          strokeWidth={1.5}
          color={colors.foreground}
          opacity={0.35}
        />
      </Group>
    </Group>
  );
}
