import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { SPLASH_BACKGROUND } from '@/components/ui/finora-mark-paths';

import { SplashMark } from './SplashMark';

const MARK_SIZE = 96;

type SplashOverlayProps = {
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  reducedMotion?: boolean;
  onLayout?: () => void;
};

/** Full-screen cream cover with restrained Skia mark reveal. */
export function SplashOverlay({
  progress,
  opacity,
  reducedMotion,
  onLayout,
}: SplashOverlayProps) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents='none'
      onLayout={onLayout}
      style={[styles.root, fadeStyle]}
    >
      <View style={styles.center}>
        <SplashMark
          size={MARK_SIZE}
          progress={progress}
          reducedMotion={reducedMotion}
        />
      </View>
    </Animated.View>
  );
}

/** Static cream placeholder while fonts/boot load (matches native splash). */
export function SplashPlaceholder() {
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND,
    zIndex: 100,
    elevation: 100,
  },
  placeholder: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
