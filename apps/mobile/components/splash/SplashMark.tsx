import type { SharedValue } from 'react-native-reanimated';

import { FinoraMarkMotion } from '@/components/ui/finora-mark-motion';
import { SPLASH_MARK_COLOR } from '@/components/ui/finora-mark-paths';

type SplashMarkProps = {
  size: number;
  progress: SharedValue<number>;
  reducedMotion?: boolean;
};

/** Splash-specific wrapper around the shared Finora mark motion. */
export function SplashMark({ size, progress, reducedMotion }: SplashMarkProps) {
  return (
    <FinoraMarkMotion
      size={size}
      progress={progress}
      color={SPLASH_MARK_COLOR}
      reducedMotion={reducedMotion}
    />
  );
}
