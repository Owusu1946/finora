import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AccountType } from '@/lib/account';

import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { setAccountType } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { useOnboardingGate } from '@/lib/onboarding-gate';
import { completeOnboarding } from '@/lib/onboarding-storage';

import { AccountPicker } from './AccountPicker';
import { OnboardingCanvas } from './OnboardingCanvas';
import { ProgressDots } from './ProgressDots';
import { LAST_STEP, ONBOARDING_STEPS } from './steps';

const SPRING = { damping: 22, stiffness: 200, mass: 0.9 };
/** Reserved vertical space for Skia hero (ring / orbs). */
const HERO_HEIGHT = 240;

export function OnboardingScreen() {
  const router = useRouter();
  const { markCompleted } = useOnboardingGate();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors, isDark } = useTheme();

  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const accountSelection = useSharedValue(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [accountType, setAccountTypeLocal] = useState<AccountType | null>(null);
  const [finishing, setFinishing] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === LAST_STEP;
  const canContinue = !isLast || accountType !== null;

  // Align canvas ring with the hero stage (below skip, above copy)
  const heroCenterY = insets.top + 12 + 28 + HERO_HEIGHT / 2;

  const commitStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(LAST_STEP, index)));
  }, []);

  // Only commit copy when progress settles near an integer (avoids mid-swipe flicker)
  useAnimatedReaction(
    () => {
      const rounded = Math.round(progress.value);
      return Math.abs(progress.value - rounded) < 0.08 ? rounded : -1;
    },
    (current, previous) => {
      if (current >= 0 && current !== previous) {
        runOnJS(commitStep)(current);
      }
    },
    [commitStep],
  );

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (previous == null) return;
      const thresholds = [1.45, 1.7, 1.95];
      for (const t of thresholds) {
        if (previous < t && current >= t) {
          runOnJS(haptics.light)();
        }
      }
    },
    [],
  );

  const goToStep = useCallback(
    (index: number, withHaptic = true) => {
      const clamped = Math.max(0, Math.min(LAST_STEP, index));
      commitStep(clamped);
      progress.value = withSpring(clamped, SPRING);
      if (withHaptic) haptics.selection();
    },
    [commitStep, progress],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          dragStart.value = progress.value;
        })
        .onUpdate((e) => {
          const next = dragStart.value - e.translationX / width;
          progress.value = Math.max(0, Math.min(LAST_STEP, next));
        })
        .onEnd((e) => {
          const projected = progress.value - e.velocityX / width / 3;
          const target = Math.max(0, Math.min(LAST_STEP, Math.round(projected)));
          progress.value = withSpring(target, SPRING);
          runOnJS(commitStep)(target);
          if (Math.round(dragStart.value) !== target) {
            runOnJS(haptics.selection)();
          }
        }),
    [commitStep, dragStart, progress, width],
  );

  const handleContinue = useCallback(async () => {
    if (isLast) {
      if (!accountType || finishing) return;
      setFinishing(true);
      try {
        await completeOnboarding(accountType);
        setAccountType(accountType);
        markCompleted();
        haptics.success();
        router.replace('/auth' as Href);
      } catch {
        setFinishing(false);
      }
      return;
    }
    goToStep(stepIndex + 1);
  }, [accountType, finishing, goToStep, isLast, markCompleted, router, stepIndex]);

  const handleAccountChange = useCallback(
    (type: AccountType) => {
      setAccountTypeLocal(type);
      accountSelection.value = withSpring(type === 'personal' ? 1 : 2, SPRING);
    },
    [accountSelection],
  );

  const handleSkip = useCallback(() => {
    goToStep(LAST_STEP);
  }, [goToStep]);

  return (
    <View className='flex-1 bg-background'>
      <OnboardingCanvas
        progress={progress}
        accountSelection={accountSelection}
        colors={colors}
        isDark={isDark}
        heroCenterY={heroCenterY}
      />

      <GestureDetector gesture={pan}>
        <View
          className='flex-1 px-6'
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 16,
            minHeight: height,
          }}
        >
          <View className='h-7 items-end justify-center'>
            {!isLast ? (
              <Pressable
                accessibilityLabel='Skip to account selection'
                hitSlop={12}
                onPress={handleSkip}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
              >
                <Text className='font-sans-medium text-base text-muted-foreground'>Skip</Text>
              </Pressable>
            ) : (
              <View />
            )}
          </View>

          {/* Skia hero lives visually here — no text overlaid */}
          <View
            className='h-[240px] w-full'
            pointerEvents='none'
          />

          <View className='flex-1 items-center justify-start gap-5 pt-2'>
            <Animated.View
              key={stepIndex}
              entering={FadeIn.duration(240)}
              exiting={FadeOut.duration(140)}
              className='items-center gap-3 px-2'
            >
              {step.brand ? (
                <>
                  <Text className='font-sans-semibold text-sm uppercase text-muted-foreground'>
                    {step.title}
                  </Text>
                  <Text className='text-center font-sans-semibold text-[29px] text-foreground'>
                    {step.subtitle}
                  </Text>
                </>
              ) : (
                <>
                  <Text className='text-center font-sans-semibold text-[29px] text-foreground'>
                    {step.title}
                  </Text>
                  <Text className='max-w-[320px] text-center font-sans-medium text-[17px] leading-[23px] text-muted-foreground'>
                    {step.subtitle}
                  </Text>
                </>
              )}
            </Animated.View>

            {isLast ? (
              <AccountPicker
                value={accountType}
                onChange={handleAccountChange}
              />
            ) : null}
          </View>

          <View className='items-center gap-5 pt-3'>
            <ProgressDots progress={progress} />

            <Pressable
              accessibilityRole='button'
              disabled={!canContinue || finishing}
              onPress={handleContinue}
              className='self-stretch items-center justify-center rounded-full py-4 active:opacity-85'
              style={{ backgroundColor: canContinue ? colors.foreground : colors.muted }}
            >
              <Text
                style={[{ color: canContinue ? colors.background : colors.mutedForeground }]}
                className='font-sans-semibold text-[17px]'
              >
                {isLast ? (finishing ? 'Continuing…' : 'Get Started') : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
