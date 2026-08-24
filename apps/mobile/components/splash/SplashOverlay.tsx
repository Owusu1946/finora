import { View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { SplashMark } from './SplashMark';

const MARK_SIZE = 96;

type SplashOverlayProps = {
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  reducedMotion?: boolean;
  onLayout?: () => void;
};

/** Full-screen cream cover with restrained Skia mark reveal. */
export function SplashOverlay({ progress, opacity, reducedMotion, onLayout }: SplashOverlayProps) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents='none'
      onLayout={onLayout}
      className='absolute inset-0 z-[100] bg-[#F7F5F2]'
      style={[{ elevation: 100 }, fadeStyle]}
    >
      <View className='flex-1 items-center justify-center'>
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
  return <View className='flex-1 bg-[#F7F5F2]' />;
}
