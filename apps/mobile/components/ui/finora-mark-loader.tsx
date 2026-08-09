import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FinoraMark, finoraToneForTheme } from '@/components/ui/finora-mark';
import { FinoraMarkMotion } from '@/components/ui/finora-mark-motion';
import { useTheme } from '@/hooks/use-theme';

const REVEAL_MS = 1400;
const HOLD_MS = 380;
const RESET_MS = 900;

type FinoraMarkLoaderProps = {
  size?: number;
  /** Defaults to theme foreground. */
  color?: string;
  /** When false, shows a settled mark (no loop). Default true. */
  looping?: boolean;
};

/**
 * Reusable Finora mark wait state — same draw motion as splash, looping.
 */
export function FinoraMarkLoader({
  size = 72,
  color,
  looping = true,
}: FinoraMarkLoaderProps) {
  const { colors, isDark } = useTheme();
  const markColor = color ?? colors.foreground;
  const [reducedMotion, setReducedMotion] = useState(false);
  const progress = useSharedValue(0);

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
    cancelAnimation(progress);

    if (!looping || reducedMotion) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }),
        withDelay(
          HOLD_MS,
          withTiming(0, { duration: RESET_MS, easing: Easing.in(Easing.cubic) }),
        ),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [looping, reducedMotion, progress]);

  if (reducedMotion) {
    return (
      <View
        style={[styles.box, { width: size, height: size }]}
        accessibilityRole='progressbar'
        accessibilityLabel='Waiting'
      >
        <FinoraMark
          variant='bare'
          size={size}
          tone={finoraToneForTheme(isDark)}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityRole='progressbar'
      accessibilityLabel='Waiting'
    >
      <FinoraMarkMotion
        size={size}
        progress={progress}
        color={markColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
