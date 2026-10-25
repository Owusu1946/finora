import { Pressable, View } from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';
import type { AccountType } from '@/lib/account';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

type AccountPickerProps = {
  value: AccountType | null;
  onChange: (type: AccountType) => void;
};

type AccountOption = {
  type: AccountType;
  label: string;
  description: string;
  icon: IconName;
};

const OPTIONS: AccountOption[] = [
  {
    type: 'personal',
    label: 'Personal',
    description: 'Send, receive, and track your own money.',
    icon: 'user',
  },
  {
    type: 'business',
    label: 'Business',
    description: 'Invoices, payouts, and team-ready wallets.',
    icon: 'bank',
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
              'flex-row items-center gap-3 rounded-xl border px-4 py-3.5 active:opacity-[0.88]',
              selected ? 'border-foreground bg-muted' : 'border-border bg-background',
            )}
          >
            <View
              className='h-10 w-10 items-center justify-center rounded-full'
              style={{ backgroundColor: selected ? colors.background : colors.muted }}
            >
              <Icon
                name={option.icon}
                size={20}
                color={selected ? colors.foreground : colors.mutedForeground}
              />
            </View>
            <View className='flex-1 gap-0.5'>
              <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
                {option.label}
              </Text>
              <Text className='font-sans text-[15px] leading-5 tracking-[-0.1px] text-muted-foreground'>
                {option.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
