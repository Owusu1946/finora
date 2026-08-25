import { Pressable } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
      className={cx(
        'h-[54px] w-full items-center justify-center rounded-[32px] px-5 py-4',
        !inactive && 'active:opacity-85',
        isPrimary && (inactive ? 'bg-muted' : 'bg-primary'),
        (isOutline || variant === 'ghost') && 'bg-transparent',
        isOutline && 'border border-border',
      )}
    >
      {loading ? (
        <LoadingIcon color={isPrimary ? colors.background : colors.foreground} />
      ) : (
        <Text
          className={cx(
            'font-sans-semibold text-[17px] tracking-[-0.2px]',
            isPrimary && (inactive ? 'text-muted-foreground' : 'text-primary-foreground'),
            !isPrimary && 'text-foreground',
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
