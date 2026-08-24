import { useAui, useAuiState, ComposerPrimitive } from '@assistant-ui/react-native';
import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, Platform, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

/**
 * Inline edit composer for user messages.
 * Since ComposerPrimitive.EditInput / EditSend / EditCancel are not yet
 * shipped in @assistant-ui/react-native@0.1.x, we build an equivalent
 * using useAui/useAuiState against the message-scoped composer.
 */
export function EditComposer() {
  const { colors } = useTheme();
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const canSend = useAuiState((s) => s.composer.canSend);
  const [localText, setLocalText] = useState(storeText);
  const inputStyle = useMemo(
    () => [styles.input, { color: colors.foreground }],
    [colors.foreground],
  );

  useEffect(() => {
    setLocalText((prev) => (prev !== storeText ? storeText : prev));
  }, [storeText]);

  return (
    <View
      className='flex-col gap-1.5 border p-2 bg-composer border-border'
      style={[styles.shell]}
    >
      <TextInput
        style={inputStyle}
        value={localText}
        onChangeText={(t) => {
          setLocalText(t);
          aui.composer.setText(t);
        }}
        placeholder='Edit message…'
        placeholderTextColor={colors.mutedForeground}
        multiline
        maxLength={4000}
        autoFocus
        {...Platform.select({
          web: {
            style: [styles.input, { color: colors.foreground, outlineStyle: 'none' } as object],
          },
          default: {},
        })}
      />
      <View className='flex-row items-center justify-end gap-2'>
        <ComposerPrimitive.Cancel
          accessibilityLabel='Cancel edit'
          onPressIn={haptics.light}
          style={({ pressed }: { pressed: boolean }) => [
            styles.cancelButton,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.muted : 'transparent',
            },
          ]}
        >
          <Icon
            name='remove'
            size={14}
            color={colors.mutedForeground}
          />
        </ComposerPrimitive.Cancel>

        <ComposerPrimitive.Send
          accessibilityLabel='Save edit'
          onPressIn={() => canSend && haptics.success()}
          style={[styles.saveButton, { backgroundColor: canSend ? colors.primary : colors.muted }]}
        >
          <Icon
            name='save'
            size={16}
            color={canSend ? colors.primaryForeground : colors.mutedForeground}
          />
        </ComposerPrimitive.Send>
      </View>
    </View>
  );
}

const styles = {
  shell: {
    borderRadius: Radius.composer,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 22,
    minHeight: 28,
    maxHeight: 132,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;
