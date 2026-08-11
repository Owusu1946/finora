import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import {
  Extrapolation,
  type SharedValue,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';

import {
  FINORA_MARK_LEFT_CRESCENT,
  FINORA_MARK_NODE,
  FINORA_MARK_RIGHT_CRESCENT,
  FINORA_MARK_VIEWBOX,
  SPLASH_MARK_COLOR,
} from '@/components/ui/finora-mark-paths';

type FinoraMarkMotionProps = {
  size: number;
  /** 0 → 1 draw progress. */
  progress: SharedValue<number>;
  color?: string;
  /** Skip trim; show full filled mark. */
  reducedMotion?: boolean;
};

/**
 * Skia Finora mark driven by a shared progress value.
 * Used by splash (one-shot) and loaders (loop).
 */
export function FinoraMarkMotion({
  size,
  progress,
  color = SPLASH_MARK_COLOR,
  reducedMotion,
}: FinoraMarkMotionProps) {
  const leftPath = useMemo(() => Skia.Path.MakeFromSVGString(FINORA_MARK_LEFT_CRESCENT), []);
  const rightPath = useMemo(() => Skia.Path.MakeFromSVGString(FINORA_MARK_RIGHT_CRESCENT), []);

  const scale = size / FINORA_MARK_VIEWBOX;

  const strokeTrim = useDerivedValue(() => {
    if (reducedMotion) return 1;
    return interpolate(progress.value, [0.02, 0.55], [0, 1], Extrapolation.CLAMP);
  });

  const fillOpacity = useDerivedValue(() => {
    if (reducedMotion) return 1;
    return interpolate(progress.value, [0.42, 0.68], [0, 1], Extrapolation.CLAMP);
  });

  const strokeOpacity = useDerivedValue(() => {
    if (reducedMotion) return 0;
    return interpolate(progress.value, [0.55, 0.75], [1, 0], Extrapolation.CLAMP);
  });

  const nodeOpacity = useDerivedValue(() => {
    if (reducedMotion) return 1;
    return interpolate(progress.value, [0.5, 0.7], [0, 1], Extrapolation.CLAMP);
  });

  const nodeScale = useDerivedValue(() => {
    if (reducedMotion) return 1;
    return interpolate(progress.value, [0.5, 0.72], [0.4, 1], Extrapolation.CLAMP);
  });

  const nodeTransform = useDerivedValue(() => {
    const s = nodeScale.value;
    const cx = FINORA_MARK_NODE.cx;
    const cy = FINORA_MARK_NODE.cy;
    return [
      { translateX: cx },
      { translateY: cy },
      { scale: s },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  if (!leftPath || !rightPath) {
    return null;
  }

  return (
    <Canvas
      style={{ width: size, height: size }}
      accessibilityLabel='Finora'
    >
      <Group transform={[{ scale }]}>
        <Group opacity={strokeOpacity}>
          <Path
            path={leftPath}
            style='stroke'
            strokeWidth={1.6}
            strokeCap='round'
            strokeJoin='round'
            color={color}
            start={0}
            end={strokeTrim}
          />
          <Path
            path={rightPath}
            style='stroke'
            strokeWidth={1.6}
            strokeCap='round'
            strokeJoin='round'
            color={color}
            start={0}
            end={strokeTrim}
          />
        </Group>

        <Group opacity={fillOpacity}>
          <Path
            path={leftPath}
            color={color}
          />
          <Path
            path={rightPath}
            color={color}
          />
        </Group>

        <Group
          opacity={nodeOpacity}
          transform={nodeTransform}
        >
          <Circle
            cx={FINORA_MARK_NODE.cx}
            cy={FINORA_MARK_NODE.cy}
            r={FINORA_MARK_NODE.r}
            color={color}
          />
        </Group>
      </Group>
    </Canvas>
  );
}
