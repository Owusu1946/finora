import { Pressable, View } from 'react-native';

import type { AccountType } from '@/lib/account';

import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

type AccountPickerProps = {
  value: AccountType | null;
  onChange: (type: AccountType) => void;
};

const OPTIONS: { type: AccountType; label: string; description: string }[] = [
  {
    type: 'personal',
    label: 'Personal',
    description: 'Send, receive, and track your own money.',
  },
  {
    type: 'business',
    label: 'Business',
    description: 'Invoices, payouts, and team-ready wallets.',
  },
];

export function AccountPicker({ value, onChange }: AccountPickerProps) {
  const { colors } = useTheme();

  return (
    <View className='mt-2 w-full gap-2.5'>
      {OPTIONS.map((option) => {
        const selected = value === option.type;
        return (
          <Pressable
            key={option.type}
            accessibilityRole='button'
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.selection();
              onChange(option.type);
            }}
            className={cx(
              'gap-1.5 rounded-2xl border px-4 py-3.5 active:opacity-[0.88]',
              selected ? 'border-foreground bg-muted' : 'border-border bg-background',
            )}
          >
            <View className='flex-row items-center gap-2'>
              <View
                className='h-1.5 w-1.5 rounded-full'
                style={{ backgroundColor: selected ? colors.foreground : colors.mutedForeground }}
              />
              <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
                {option.label}
              </Text>
            </View>
            <Text className='pl-3.5 font-sans text-[15px] leading-5 tracking-[-0.1px] text-muted-foreground'>
              {option.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
