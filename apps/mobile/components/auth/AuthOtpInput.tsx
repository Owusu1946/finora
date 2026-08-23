import { useRef, type ElementRef } from 'react';
import { Pressable, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';

const OTP_LENGTH = 6;

type AuthOtpInputProps = {
  value: string;
  onChange: (code: string) => void;
  error?: string;
  autoFocus?: boolean;
};

export function AuthOtpInput({ value, onChange, error, autoFocus = true }: AuthOtpInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  const digits = value.padEnd(OTP_LENGTH).slice(0, OTP_LENGTH).split('');

  return (
    <View className='gap-2.5'>
      <Pressable
        accessibilityRole='none'
        onPress={() => inputRef.current?.focus()}
        className='flex-row justify-between gap-2'
      >
        {digits.map((digit, index) => {
          const filled = digit.trim().length > 0;
          const active = value.length === index;
          return (
            <View
              key={index}
              className={cx(
                'max-h-14 flex-1 items-center justify-center rounded-[22px] border bg-composer',
                error ? 'border-destructive' : active ? 'border-foreground' : 'border-border',
              )}
            >
              <Text className='font-sans-semibold text-[23px] tracking-[-0.4px] text-foreground'>
                {filled ? digit : ''}
              </Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType='number-pad'
        textContentType='oneTimeCode'
        autoComplete='one-time-code'
        autoFocus={autoFocus}
        maxLength={OTP_LENGTH}
        caretHidden
        className='absolute inset-0 text-transparent opacity-[0.02]'
        accessibilityLabel='One-time passcode'
      />

      {error ? (
        <Text className='text-center font-sans-medium text-[13px] text-destructive'>{error}</Text>
      ) : null}
    </View>
  );
}

export const AUTH_OTP_LENGTH = OTP_LENGTH;
