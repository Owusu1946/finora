import type { ReactNode } from 'react';

import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Both checks: the first says the app is built for Liquid Glass, the second
// guards against iOS 26 betas that lack the API and crash.
const liquidGlass =
  process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * How the composer is drawn: Liquid Glass on iOS 26+, the system chrome blur
 * on older iOS, and an opaque surface on Android, on web, or when the user
 * turned on Reduce Transparency.
 */
export type ComposerSurfaceMode = 'glass' | 'blur' | 'solid';

export function useComposerSurfaceMode(): ComposerSurfaceMode {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (process.env.EXPO_OS !== 'ios') return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (active) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (process.env.EXPO_OS !== 'ios' || reduceTransparency) return 'solid';
  return liquidGlass ? 'glass' : 'blur';
}

/**
 * Lets neighbouring glass pieces (the + button and the input) blend into each
 * other like system bars do. A plain row everywhere else.
 */
export function ComposerGlassGroup({
  mode,
  style,
  children,
}: {
  mode: ComposerSurfaceMode;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (mode === 'glass') {
    return (
      <GlassContainer
        spacing={8}
        style={style}
      >
        {children}
      </GlassContainer>
    );
  }
  return <View style={style}>{children}</View>;
}

/**
 * One floating composer surface. `interactive` gives glass the native touch
 * response; set it once per surface, never toggle it. Never fade a surface
 * or its parents to zero opacity: glass stops rendering.
 */
export function ComposerSurface({
  mode,
  interactive = false,
  style,
  children,
}: {
  mode: ComposerSurfaceMode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Optional: a surface can also be a backdrop placed behind native controls. */
  children?: ReactNode;
}) {
  const { colors, isDark } = useTheme();

  if (mode === 'glass') {
    return (
      <GlassView
        isInteractive={interactive}
        glassEffectStyle='regular'
        colorScheme={isDark ? 'dark' : 'light'}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  if (mode === 'blur') {
    return (
      <BlurView
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={80}
        style={[
          styles.clip,
          { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          // Lifts the surface off the messages scrolling underneath it.
          boxShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.35)' : '0 2px 10px rgba(0, 0, 0, 0.08)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Native press feedback for a round composer button: the Material ripple on
 * Android, and a quick dim-and-shrink on iOS like system bar buttons.
 */
export function useComposerPressFeedback(size: number) {
  const { isDark } = useTheme();
  return {
    android_ripple: {
      color: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
      borderless: true,
      radius: size / 2,
    },
    pressedStyle: (pressed: boolean): ViewStyle =>
      process.env.EXPO_OS === 'ios' && pressed
        ? { opacity: 0.55, transform: [{ scale: 0.92 }] }
        : {},
  };
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
