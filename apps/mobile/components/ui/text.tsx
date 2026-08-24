import { forwardRef } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { useSettings } from '@/lib/settings-context';

function scaleTextStyle(style: TextProps['style'], enabled: boolean) {
  if (!enabled) return style;
  const flattened = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flattened.fontSize === 'number' ? flattened.fontSize : 14;
  const lineHeight =
    typeof flattened.lineHeight === 'number' ? flattened.lineHeight + 2 : undefined;
  return [{ ...flattened, fontSize: fontSize + 2, ...(lineHeight ? { lineHeight } : {}) }];
}

export const AppText = forwardRef<NativeText, TextProps>(function AppText(
  { style, ...props },
  ref,
) {
  const { settings } = useSettings();
  return (
    <NativeText
      ref={ref}
      {...props}
      style={scaleTextStyle(style, settings.largerText)}
    />
  );
});

export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(function AppTextInput(
  { style, ...props },
  ref,
) {
  const { settings } = useSettings();
  return (
    <NativeTextInput
      ref={ref}
      {...props}
      style={scaleTextStyle(style, settings.largerText)}
    />
  );
});
