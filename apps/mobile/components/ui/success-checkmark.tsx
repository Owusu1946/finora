import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import {
  Easing,
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

type SuccessCheckmarkProps = {
  size?: number;
  /** Circle / check color. Defaults to theme foreground. */
  color?: string;
  /** Disc behind the mark. Defaults to theme muted. */
  backgroundColor?: string;
};

/**
 * Apple Pay–style success mark: disc springs in, then the check draws.
 */
export function SuccessCheckmark({ size = 72, color, backgroundColor }: SuccessCheckmarkProps) {
  const { colors } = useTheme();
  const markColor = color ?? colors.foreground;
  const discColor = backgroundColor ?? colors.muted;
  const [reducedMotion, setReducedMotion] = useState(false);

  const progress = useSharedValue(0);
  const scale = useSharedValue(0.55);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      progress.value = 1;
      return;
    }

    scale.value = 0.55;
    progress.value = 0;

    // Soft overshoot like Apple Pay’s confirmation disc.
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 160,
      mass: 0.7,
    });

    progress.value = withDelay(
      120,
      withSequence(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })),
    );
  }, [reducedMotion, progress, scale]);

  const checkPath = useMemo(() => {
    const p = Skia.Path.Make();
    // Normalized in a 64×64 viewBox, inset for the disc.
    p.moveTo(18, 33);
    p.lineTo(28, 43);
    p.lineTo(46, 23);
    return p;
  }, []);

  const canvasScale = size / 64;

  const discScale = useDerivedValue(() => scale.value);

  const trimEnd = useDerivedValue(() => {
    if (reducedMotion) return 1;
    return interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
  });

  const transform = useDerivedValue(() => [
    { translateX: 32 },
    { translateY: 32 },
    { scale: discScale.value },
    { translateX: -32 },
    { translateY: -32 },
  ]);

  if (reducedMotion) {
    return (
      <View
        className='items-center justify-center rounded-full'
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: discColor,
        }}
        accessibilityRole='image'
        accessibilityLabel='Success'
      >
        <Icon
          name='check'
          size={size * 0.42}
          color={markColor}
        />
      </View>
    );
  }

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole='image'
      accessibilityLabel='Success'
    >
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: canvasScale }]}>
          <Group transform={transform}>
            <Circle
              cx={32}
              cy={32}
              r={30}
              color={discColor}
            />
            <Path
              path={checkPath}
              style='stroke'
              strokeWidth={4.5}
              strokeCap='round'
              strokeJoin='round'
              color={markColor}
              start={0}
              end={trimEnd}
            />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
