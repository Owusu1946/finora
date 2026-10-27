import type { ReactNode } from 'react';

import { Keyboard, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/**
 * Swipe-down-to-hide-keyboard wrapper for surfaces natively covered by
 * keyboardDismissMode='interactive' ScrollViews: short lists that never
 * scroll, the composer, and empty states. A decisive downward drag (distance
 * or fling velocity) dismisses the keyboard; taps and upward pans are never
 * captured. Long message lists keep their native interactive peel.
 */
export function SwipeKeyboardDismiss({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const dismiss = () => {
    if (Keyboard.isVisible()) Keyboard.dismiss();
  };

  const pan = Gesture.Pan()
    .activeOffsetY(24)
    .onEnd((event) => {
      if (event.translationY > 40 || event.velocityY > 750) {
        runOnJS(dismiss)();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        pointerEvents='box-none'
        className={className}
      >
        {children}
      </View>
    </GestureDetector>
  );
}
