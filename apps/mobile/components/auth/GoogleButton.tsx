import { Pressable, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
      className={cx(
        'h-[54px] w-full items-center justify-center rounded-[32px] border border-border bg-background px-5 py-3.5',
        inactive ? 'opacity-60' : 'active:opacity-[0.88]',
      )}
    >
      {loading ? (
        <LoadingIcon color={colors.foreground} />
      ) : (
        <View className='flex-row items-center gap-2.5'>
          <GoogleIcon size={20} />
          <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
            Continue with Google
          </Text>
        </View>
      )}
    </Pressable>
  );
}
