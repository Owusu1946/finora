import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';

/** Same dimming feel as the bottom sheet. */
const DIM_OPACITY = 0.4;
const OPEN_MS = 220;
const CLOSE_MS = 160;
const CARD_SCALE = 0.92;

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Centered destructive-action confirmation card. Modal + dark scrim like
 * SheetModal, but compact and anchored to the middle of the screen instead of
 * the bottom edge. Scrim tap or Android back cancels.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(visible);
  const closingRef = useRef(false);
  const scrim = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(CARD_SCALE);

  const finishClose = () => {
    closingRef.current = false;
    setMounted(false);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      closingRef.current = false;
      haptics.light();
      const id = requestAnimationFrame(() => {
        scrim.value = withTiming(DIM_OPACITY, {
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
        cardScale.value = withSpring(1, { damping: 24, stiffness: 320 });
      });
      return () => cancelAnimationFrame(id);
    }
    if (mounted && !closingRef.current) {
      closingRef.current = true;
      scrim.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
      cardOpacity.value = withTiming(
        0,
        { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
      cardScale.value = withTiming(CARD_SCALE, {
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const confirm = () => {
    haptics.error();
    onConfirm();
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View className='flex-1 items-center justify-center px-10'>
        <Animated.View
          pointerEvents='box-none'
          className='absolute inset-0 bg-black'
          style={scrimStyle}
        >
          <Pressable
            className='absolute inset-0'
            onPress={onCancel}
            accessibilityLabel='Cancel'
          />
        </Animated.View>

        <Animated.View
          className='w-full max-w-[320px] items-center rounded-[22px] border border-border bg-card px-5 pb-4 pt-5'
          style={cardStyle}
        >
          <Text className='text-center font-sans-semibold text-[17px] tracking-[-0.3px] text-foreground'>
            {title}
          </Text>
          <Text
            numberOfLines={3}
            className='mt-1.5 text-center font-sans text-[13px] leading-[18px] text-muted-foreground'
          >
            {body}
          </Text>
          <View className='mt-4 flex-row gap-2.5 self-stretch'>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              className='min-h-[42px] flex-1 items-center justify-center rounded-lg bg-muted active:bg-border'
            >
              <Text className='font-sans-semibold text-sm text-foreground'>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={confirmLabel}
              onPress={confirm}
              className='min-h-[42px] flex-1 items-center justify-center rounded-lg bg-destructive active:opacity-80'
            >
              <Text className='font-sans-semibold text-sm text-white'>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
