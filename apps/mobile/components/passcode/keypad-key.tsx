import type { ReactNode } from 'react';

import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Keypad key that fires on touch-down, like the system passcode pad, with a
 * pressed highlight driven by the press state itself. VoiceOver activation
 * goes through the accessibility action instead of the touch.
 */
export function KeypadKey({
  label,
  size,
  disabled,
  bordered,
  onActivate,
  children,
}: {
  label: string;
  size: number;
  disabled: boolean;
  bordered: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') onActivate();
      }}
      disabled={disabled}
      onPressIn={onActivate}
      style={({ pressed }) => [
        styles.key,
        { width: size, height: size, borderRadius: size / 2 },
        bordered
          ? {
              backgroundColor: pressed ? colors.muted : colors.composer,
              borderColor: colors.border,
              borderWidth: 1,
            }
          : { opacity: pressed ? 0.55 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  key: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
