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
import { useWindowDimensions } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

type AuthCanvasProps = {
  colors: Palette;
};

export function AuthCanvas({ colors }: AuthCanvasProps) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();
  const cx = width / 2;
  const cy = height * 0.16;

  const orb1Cx = useDerivedValue(() => {
    const t = clock.value / 1000;
    return cx + Math.sin(t * 0.35) * 22;
  });
  const orb1Cy = useDerivedValue(() => {
    const t = clock.value / 1000;
    return cy + Math.cos(t * 0.3) * 14;
  });
  const orb2Cx = useDerivedValue(() => {
    const t = clock.value / 1000;
    return cx + Math.cos(t * 0.28) * 32;
  });
  const orb2Cy = useDerivedValue(() => {
    const t = clock.value / 1000;
    return cy + 24 + Math.sin(t * 0.4) * 16;
  });

  return (
    <Canvas
      className='absolute inset-0'
      pointerEvents='none'
    >
      <Fill>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={[colors.background, colors.muted, colors.background]}
        />
      </Fill>
      <Group opacity={0.16}>
        <Circle
          cx={orb1Cx}
          cy={orb1Cy}
          r={110}
          color={colors.mutedForeground}
        >
          <BlurMask
            blur={56}
            style='normal'
          />
        </Circle>
        <Circle
          cx={orb2Cx}
          cy={orb2Cy}
          r={72}
          color={colors.ring}
        >
          <BlurMask
            blur={48}
            style='normal'
          />
        </Circle>
      </Group>
    </Canvas>
  );
}
