import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

import { STEP_COUNT } from './steps';

type ProgressDotsProps = {
  progress: SharedValue<number>;
};

function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const { colors } = useTheme();

  const style = useAnimatedStyle(() => {
    const dist = Math.abs(progress.value - index);
    const active = Math.max(0, 1 - dist);
    return {
      width: 6 + active * 12,
      opacity: 0.3 + active * 0.7,
      backgroundColor: colors.foreground,
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

export function ProgressDots({ progress }: ProgressDotsProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole='progressbar'
    >
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <Dot
          key={i}
          index={i}
          progress={progress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
