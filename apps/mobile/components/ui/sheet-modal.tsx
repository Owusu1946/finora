import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

const OPEN_MS = 280;
const CLOSE_MS = 220;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
/** Soft scrim — enough to push focus to the sheet without feeling heavy. */
const DIM_OPACITY = 0.4;
const SHEET_SLIDE = 640;

type SheetModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Styles for the sheet panel (not the scrim). */
  style?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  keyboardAvoiding?: boolean;
  /** Dim strength 0–1. Default 0.4 */
  dimOpacity?: number;
};

export function SheetModal({
  visible,
  onClose,
  children,
  style,
  showHandle = true,
  keyboardAvoiding = false,
  dimOpacity = DIM_OPACITY,
}: SheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const closingRef = useRef(false);
  /** Who started the close animation — only gesture path should call onClose. */
  const closeSourceRef = useRef<'none' | 'gesture' | 'prop'>('none');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const translateY = useSharedValue(SHEET_SLIDE);
  const scrim = useSharedValue(0);
  const dragY = useSharedValue(0);

  const finishClose = () => {
    const source = closeSourceRef.current;
    closeSourceRef.current = 'none';
    closingRef.current = false;
    setMounted(false);
    if (source === 'gesture') onCloseRef.current();
  };

  const animateOpen = () => {
    closingRef.current = false;
    closeSourceRef.current = 'none';
    translateY.value = SHEET_SLIDE;
    dragY.value = 0;
    scrim.value = 0;
    translateY.value = withTiming(0, {
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
    scrim.value = withTiming(dimOpacity, {
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  };

  const markGestureClosing = () => {
    closeSourceRef.current = 'gesture';
    closingRef.current = true;
  };

  const animateClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    // Keep the finger position — zeroing drag first would snap the sheet up.
    translateY.value = translateY.value + dragY.value;
    dragY.value = 0;
    translateY.value = withTiming(
      SHEET_SLIDE,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
    scrim.value = withTiming(0, {
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
    });
  };

  /** Scrim tap, swipe, or Android back — we own dismissing the parent. */
  const requestDismiss = () => {
    if (closingRef.current) return;
    closeSourceRef.current = 'gesture';
    animateClose();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        animateOpen();
      });
      return () => cancelAnimationFrame(id);
    }
    if (mounted && !closingRef.current) {
      closeSourceRef.current = 'prop';
      animateClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        // Animate on the UI thread from the current drag position so we never
        // snap up while waiting on the JS bridge.
        const current = translateY.value + dragY.value;
        dragY.value = 0;
        translateY.value = current;
        runOnJS(markGestureClosing)();
        translateY.value = withTiming(
          SHEET_SLIDE,
          { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(finishClose)();
          },
        );
        scrim.value = withTiming(0, {
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
        });
        return;
      }
      dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrim.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  if (!mounted) return null;

  const panel = (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
          style,
          sheetStyle,
        ]}
      >
        {showHandle ? (
          <View style={styles.handleHit}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
        ) : null}
        {children}
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={requestDismiss}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents='box-none'
          style={[styles.scrim, scrimStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestDismiss}
            accessibilityRole='button'
            accessibilityLabel='Dismiss'
          />
        </Animated.View>

        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.sheetHost}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents='box-none'
          >
            {panel}
          </KeyboardAvoidingView>
        ) : (
          <View
            style={styles.sheetHost}
            pointerEvents='box-none'
          >
            {panel}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
