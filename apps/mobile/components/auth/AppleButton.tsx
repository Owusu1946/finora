import { Pressable, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

import { AppleIcon } from './AppleIcon';

type AppleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function AppleButton({ onPress, loading = false, disabled = false }: AppleButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel='Continue with Apple'
      disabled={inactive}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className={cx(
        'h-[54px] w-full items-center justify-center rounded-[32px] border border-border bg-background px-5 py-3.5',
        inactive ? 'opacity-60' : 'active:opacity-[0.88]',
      )}
    >
      {loading ? (
        <LoadingIcon color={colors.foreground} />
      ) : (
        <View className='flex-row items-center gap-2.5'>
          <AppleIcon
            size={20}
            color={colors.foreground}
          />
          <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
            Continue with Apple
          </Text>
        </View>
      )}
    </Pressable>
  );
}
