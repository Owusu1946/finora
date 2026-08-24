import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

type AuthFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  password?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'>;

export function AuthField({
  label,
  value,
  onChangeText,
  error,
  password,
  ...inputProps
}: AuthFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View className='gap-2'>
      <Text className='font-sans-medium text-sm tracking-[-0.1px] text-muted-foreground'>
        {label}
      </Text>
      <View
        className={cx(
          'min-h-[54px] flex-row items-center gap-2.5 rounded-[32px] border bg-composer px-4 py-[15px]',
          focused ? 'border-foreground' : error ? 'border-destructive' : 'border-border',
        )}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={password && !visible}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={password ? 'none' : inputProps.autoCapitalize}
          autoCorrect={false}
          className='flex-1 font-sans py-0 text-[17px] tracking-[-0.2px] text-foreground'
          {...inputProps}
        />
        {password ? (
          <Pressable
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => {
              haptics.selection();
              setVisible((v) => !v);
            }}
          >
            <Icon
              name={visible ? 'eye-off' : 'eye'}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className='font-sans-medium text-[13px] text-destructive'>{error}</Text>
      ) : null}
    </View>
  );
}
