import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const SCROLL_THRESHOLD = 120;

/**
 * useScrollToBottom – manages scroll-to-bottom state and provides a
 * ref + handler to wire into a FlatList.
 *
 * Returns:
 *  - flatListRef: to attach to the FlatList via ref
 *  - isAtBottom: whether the list is near the bottom
 *  - scrollToBottom: imperative scroll-to-end
 *  - onScroll: handler to pass to FlatList's onScroll
 */
export function useScrollToBottom() {
  const flatListRef = useRef<FlatList>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setIsAtBottom(distanceFromBottom <= SCROLL_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  return { flatListRef, isAtBottom, scrollToBottom, onScroll };
}

/**
 * Floating scroll-to-bottom button.
 * Fades in/out based on `visible` prop.
 */
export function ScrollToBottomButton({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      className='absolute bottom-3 self-center z-[10]'
      style={[styles.wrapper, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={() => {
          haptics.light();
          onPress();
        }}
        accessibilityLabel='Scroll to bottom'
        className='h-14 w-14 items-center justify-center rounded-full shadow-md'
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.card,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
      >
        <Icon
          name='arrow-down'
          size={22}
          color={colors.foreground}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = {
  wrapper: {
    position: 'absolute' as const,
    bottom: 12,
    alignSelf: 'center' as const,
    zIndex: 10,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
