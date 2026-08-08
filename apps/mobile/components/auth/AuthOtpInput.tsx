import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useRef, type ElementRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole='none'
        onPress={() => inputRef.current?.focus()}
        style={styles.cells}
      >
        {digits.map((digit, index) => {
          const filled = digit.trim().length > 0;
          const active = value.length === index;
          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  backgroundColor: colors.composer,
                  borderColor: error
                    ? colors.destructive
                    : active
                      ? colors.foreground
                      : colors.border,
                },
              ]}
            >
              <Text style={[styles.digit, { color: colors.foreground }]}>
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
        style={styles.hiddenInput}
        accessibilityLabel='One-time passcode'
      />

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

export const AUTH_OTP_LENGTH = OTP_LENGTH;

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    maxHeight: 56,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
