import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cx } from '@/lib/cx';

const ROWS = 3;

/** Placeholder rows shaped like `VirtualCardListItem` while cards load. */
export function CardListSkeleton() {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reducedMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessible
      accessibilityLabel='Loading cards'
      style={pulseStyle}
    >
      {Array.from({ length: ROWS }, (_, index) => (
        <View
          key={index}
          className={cx(
            'flex-row items-center gap-3 py-3.5',
            index < ROWS - 1 && 'border-b border-border',
          )}
        >
          <View
            className='rounded-lg bg-muted'
            style={{ width: 54, height: 34, borderCurve: 'continuous' }}
          />
          <View className='flex-1 gap-1.5'>
            <View className='h-4 w-28 rounded-full bg-muted' />
            <View className='h-3 w-16 rounded-full bg-muted' />
          </View>
          <View className='items-end gap-1.5'>
            <View className='h-3.5 w-14 rounded-full bg-muted' />
            <View className='h-2.5 w-10 rounded-full bg-muted' />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
