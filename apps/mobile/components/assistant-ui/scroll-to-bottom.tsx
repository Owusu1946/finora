import { useRef, useCallback, useEffect, useState } from "react";
import {
  Pressable,
  Animated,
  StyleSheet,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import { haptics } from "@/lib/haptics";

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

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      setIsAtBottom(distanceFromBottom <= SCROLL_THRESHOLD);
    },
    [],
  );

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
      style={[styles.wrapper, { opacity }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Pressable
        onPress={() => {
          haptics.light();
          onPress();
        }}
        accessibilityLabel="Scroll to bottom"
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
      >
        <Icon name="arrow-down" size={18} color={colors.foreground} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    zIndex: 10,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
});
