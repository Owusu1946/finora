import { useMemo, type ReactNode } from 'react';
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
function dismissKeyboard() {
  if (Keyboard.isVisible()) Keyboard.dismiss();
}

export function SwipeKeyboardDismiss({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // Built once: the thread re-renders on every streamed token, and a new
  // gesture each render re-attaches the handler (and can reset a live swipe).
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(24)
        // Fail on sideways drags right away so the drawer's swipe wins cleanly.
        .failOffsetX([-16, 16])
        .onEnd((event) => {
          if (event.translationY > 40 || event.velocityY > 750) {
            runOnJS(dismissKeyboard)();
          }
        }),
    [],
  );

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
