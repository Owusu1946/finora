import { AppText as Text } from '@/components/ui/text';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
};

export function AuthButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: AuthButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole='button'
      disabled={inactive}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && {
          backgroundColor: inactive ? colors.muted : colors.foreground,
        },
        isOutline && {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        { opacity: pressed && !inactive ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.background : colors.foreground} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: isPrimary
                ? inactive
                  ? colors.mutedForeground
                  : colors.background
                : colors.foreground,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Radius.composer,
    minHeight: 54,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
