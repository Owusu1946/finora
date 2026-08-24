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

  const namedSizes: Record<string, number> = {
    'text-xs': 12,
    'text-sm': 14,
    'text-base': 16,
    'text-lg': 18,
    'text-xl': 20,
    'text-2xl': 24,
    'text-3xl': 30,
    'text-4xl': 36,
  };
  const sizeIndex = classes.findIndex(
    (value) => namedSizes[value] != null || /^text-\[\d+(?:\.\d+)?px\]$/.test(value),
  );

  if (sizeIndex >= 0) {
    const current = classes[sizeIndex];
    const [match] = current.match(/\d+(?:\.\d+)?/) ?? ['14'];
    classes[sizeIndex] = `text-[${(namedSizes[current] ?? Number(match)) + 2}px]`;
  } else {
    classes.push('text-[16px]');
  }

  return classes;
}

function scaleNativeStyle(style: TextProps['style'], enabled: boolean) {
  if (!enabled) return style;
  const flattened = StyleSheet.flatten(style) ?? {};
  if (typeof flattened.fontSize !== 'number') return style;

  const fontSize = flattened.fontSize;
  const lineHeight =
    typeof flattened.lineHeight === 'number' ? flattened.lineHeight + 2 : undefined;
  return [{ ...flattened, fontSize: fontSize + 2, ...(lineHeight != null ? { lineHeight } : {}) }];
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
