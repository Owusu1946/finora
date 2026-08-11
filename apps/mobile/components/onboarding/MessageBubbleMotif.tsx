import { BlurMask, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import {
  Extrapolation,
  type SharedValue,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

type MessageBubbleMotifProps = {
  progress: SharedValue<number>;
  cx: number;
  cy: number;
  colors: Palette;
  isDark: boolean;
};

/** Chat-bubble outline that draws in on Beat 1 (Speak). */
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

  const opacity = useDerivedValue(() => {
    return interpolate(progress.value, [0.35, 0.85, 1.15, 1.55], [0, 1, 1, 0], Extrapolation.CLAMP);
  });

  const trimEnd = useDerivedValue(() => {
    return interpolate(progress.value, [0.45, 1, 1.25], [0, 1, 1], Extrapolation.CLAMP);
  });

  const fillOpacity = useDerivedValue(() => {
    return interpolate(progress.value, [0.7, 1, 1.2, 1.5], [0, 0.14, 0.14, 0], Extrapolation.CLAMP);
  });

  // Secondary “reply” capsule
  const replyOpacity = useDerivedValue(() => {
    return interpolate(
      progress.value,
      [0.75, 1.05, 1.25, 1.55],
      [0, 0.7, 0.7, 0],
      Extrapolation.CLAMP,
    );
  });

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
