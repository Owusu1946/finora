import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

const SWIPE_DISTANCE = 88;
const SWIPE_VELOCITY = 700;

export function SwipeBackView({ children }: { children: ReactNode }) {
  const router = useRouter();
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(18)
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          if (event.translationX < SWIPE_DISTANCE && event.velocityX < SWIPE_VELOCITY) return;
          runOnJS(haptics.selection)();
          runOnJS(router.back)();
        }),
    [router],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
