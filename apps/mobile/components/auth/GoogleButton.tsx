import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { GoogleIcon } from './GoogleIcon';

type GoogleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function GoogleButton({ onPress, loading = false, disabled = false }: GoogleButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel='Continue with Google'
      disabled={inactive}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
          opacity: pressed && !inactive ? 0.88 : inactive ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.foreground} />
      ) : (
        <View style={styles.row}>
          <GoogleIcon size={20} />
          <Text style={[styles.label, { color: colors.foreground }]}>Continue with Google</Text>
        </View>
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
