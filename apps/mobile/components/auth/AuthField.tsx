import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.composer,
            borderColor: focused ? colors.foreground : error ? colors.destructive : colors.border,
          },
        ]}
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
          style={[styles.input, { color: colors.foreground }]}
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
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 54,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
});
