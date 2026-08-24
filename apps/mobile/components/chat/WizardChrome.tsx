import type { ReactNode } from 'react';

import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export function WizardChip({
  label,
  selected,
  onPress,
  subtle,
  leading,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  subtle?: boolean;
  /** Optional leading node (e.g. circular CurrencyIcon). */
  leading?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className='flex-row items-center gap-1.5 px-3 py-2.5 rounded-full border'
      style={[
        {
          backgroundColor: selected ? colors.foreground : colors.muted,
          borderColor: selected ? colors.foreground : colors.border,
          opacity: subtle && !selected ? 0.85 : 1,
        },
      ]}
    >
      {leading ? <View className='-ml-0.5'>{leading}</View> : null}
      <Text
        className='font-sans-semibold text-[14px]'
        style={[{ color: selected ? colors.background : colors.foreground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WizardStepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View className='gap-2 mb-1'>
      <Text className='font-sans-semibold text-[12px] tracking-[0.2px] uppercase text-muted-foreground'>
        Step {step} of {total}
      </Text>
      <View className='flex-row gap-1 items-center'>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            className='h-1.5 rounded-[3px]'
            style={[
              {
                backgroundColor: i < step ? colors.foreground : colors.border,
                width: i === step - 1 ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
      <Text className='font-sans-semibold text-[19px] tracking-[-0.3px] mt-1 text-foreground'>
        {title}
      </Text>
      {subtitle ? (
        <Text className='font-sans-medium text-[14px] leading-[18px] text-muted-foreground'>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
