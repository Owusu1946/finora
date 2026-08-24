import { forwardRef } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { cx } from '@/lib/cx';
import { useSettings } from '@/lib/settings-context';

function scaledClassName(className: string | undefined, enabled: boolean) {
  const classes = className?.split(' ') ?? [];
  if (!enabled) return classes;

  const sizeIndex = classes.findIndex((value) => /^text-\[\d+(?:\.\d+)?px\]$/.test(value));

  if (sizeIndex >= 0) {
    const [match] = classes[sizeIndex].match(/\d+(?:\.\d+)?/) ?? ['14'];
    classes[sizeIndex] = `text-[${Number(match) + 2}px]`;
  } else {
    classes.push('text-[16px]');
  }

  return classes;
}

function scaleNativeStyle(style: TextProps['style'], enabled: boolean) {
  if (!enabled) return style;
  const flattened = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flattened.fontSize === 'number' ? flattened.fontSize : 14;
  const lineHeight =
    typeof flattened.lineHeight === 'number' ? flattened.lineHeight + 2 : undefined;
  return [{ ...flattened, fontSize: fontSize + 2, ...(lineHeight ? { lineHeight } : {}) }];
}

export const AppText = forwardRef<NativeText, TextProps>(function AppText(
  { className, style, ...props },
  ref,
) {
  const { settings } = useSettings();
  return (
    <NativeText
      ref={ref}
      {...props}
      style={scaleNativeStyle(style, settings.largerText)}
      className={cx(...scaledClassName(className, settings.largerText))}
    />
  );
});

export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(function AppTextInput(
  { className, style, ...props },
  ref,
) {
  const { settings } = useSettings();
  return (
    <NativeTextInput
      ref={ref}
      {...props}
      style={scaleNativeStyle(style, settings.largerText)}
      className={cx(...scaledClassName(className, settings.largerText))}
    />
  );
});
