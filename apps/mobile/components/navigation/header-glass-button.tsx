import type { ReactNode } from 'react';

import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconProps } from '@/components/ui/icon-mappings';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

const BUTTON_SIZE = 48;
const ICON_SIZE = 24;

const liquidGlass = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable();

const surfaceShape: ViewStyle = {
  height: BUTTON_SIZE,
  minWidth: BUTTON_SIZE,
  borderRadius: BUTTON_SIZE / 2,
  borderCurve: 'continuous',
  flexDirection: 'row',
  alignItems: 'center',
  overflow: 'hidden',
};

/**
 * Native header surface: Liquid Glass on iOS 26+, system chrome blur on older
 * iOS, and a Material tonal surface on Android. Group several
 * `HeaderGlassButton`s in one surface the way iOS groups bar items.
 */
export function HeaderGlassSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();

  if (liquidGlass) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle='regular'
        colorScheme={isDark ? 'dark' : 'light'}
        style={[surfaceShape, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (process.env.EXPO_OS === 'ios') {
    return (
      <BlurView
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={80}
        style={[
          surfaceShape,
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
        surfaceShape,
        { backgroundColor: colors.muted, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function HeaderGlassButton({
  icon,
  label,
  onPress,
}: {
  icon: IconProps['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      android_ripple={{
        color: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
        borderless: true,
        radius: BUTTON_SIZE / 2,
      }}
      style={({ pressed }) => ({
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        // Liquid Glass and the Android ripple give their own press feedback.
        opacity: process.env.EXPO_OS === 'ios' && !liquidGlass && pressed ? 0.6 : 1,
      })}
    >
      <Icon
        name={icon}
        size={ICON_SIZE}
        color={colors.foreground}
      />
    </Pressable>
  );
}
