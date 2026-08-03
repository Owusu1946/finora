import { BlurMask, Circle, Group } from '@shopify/react-native-skia';
import {
  Extrapolation,
  type SharedValue,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

type AccountSplitDiscsProps = {
  progress: SharedValue<number>;
  /** 0 = none, 1 = personal (left), 2 = business (right) */
  selection: SharedValue<number>;
  cx: number;
  cy: number;
  colors: Palette;
  isDark: boolean;
};

/** Two soft discs that separate on Beat 3; selected side brightens. */
export function AccountSplitDiscs({
  progress,
  selection,
  cx,
  cy,
  colors,
  isDark,
}: AccountSplitDiscsProps) {
  const baseR = 58;
  const spread = 74;

  const opacity = useDerivedValue(() => {
    return interpolate(progress.value, [2.35, 2.75, 3], [0, 1, 1], Extrapolation.CLAMP);
  });

  const leftX = useDerivedValue(() => {
    const sep = interpolate(progress.value, [2.4, 3], [8, spread], Extrapolation.CLAMP);
    return cx - sep;
  });

  const rightX = useDerivedValue(() => {
    const sep = interpolate(progress.value, [2.4, 3], [8, spread], Extrapolation.CLAMP);
    return cx + sep;
  });

  const leftGlow = useDerivedValue(() => {
    const sel = selection.value === 1 ? 1 : 0;
    return 0.35 + sel * 0.45;
  });

  const rightGlow = useDerivedValue(() => {
    const sel = selection.value === 2 ? 1 : 0;
    return 0.35 + sel * 0.45;
  });

  const leftR = useDerivedValue(() => {
    return baseR + (selection.value === 1 ? 12 : 0);
  });

  const rightR = useDerivedValue(() => {
    return baseR + (selection.value === 2 ? 12 : 0);
  });

  const fill = colors.foreground;
  const bloom = isDark ? 0.18 : 0.1;
  const core = isDark ? 0.28 : 0.16;

  return (
    <Group opacity={opacity}>
      <Group opacity={leftGlow}>
        <Circle
          cx={leftX}
          cy={cy}
          r={leftR}
          color={fill}
          opacity={bloom}
        >
          <BlurMask
            blur={22}
            style='normal'
          />
        </Circle>
        <Circle
          cx={leftX}
          cy={cy}
          r={26}
          color={fill}
          opacity={core}
        >
          <BlurMask
            blur={8}
            style='normal'
          />
        </Circle>
      </Group>

      <Group opacity={rightGlow}>
        <Circle
          cx={rightX}
          cy={cy}
          r={rightR}
          color={fill}
          opacity={bloom}
        >
          <BlurMask
            blur={22}
            style='normal'
          />
        </Circle>
        <Circle
          cx={rightX}
          cy={cy}
          r={26}
          color={fill}
          opacity={core}
        >
          <BlurMask
            blur={8}
            style='normal'
          />
        </Circle>
      </Group>
    </Group>
  );
}
