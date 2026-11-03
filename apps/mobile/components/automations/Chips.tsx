import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

/** A row of pill choices; one is selected at a time. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className='flex-row flex-wrap gap-2'>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole='button'
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            className={cx(
              'rounded-full border px-4 py-2',
              selected ? 'border-foreground bg-foreground' : 'border-border bg-background',
            )}
          >
            <Text
              className='font-sans-medium text-sm'
              style={{ color: selected ? colors.background : colors.foreground }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
