import { AppTextInput as TextInput } from '@/components/ui/text';
import { useAui, useAuiState, ComposerPrimitive } from '@assistant-ui/react-native';
import { View, Platform, StyleSheet } from 'react-native';

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
  const text = useAuiState((s) => s.composer.text);
  const canSend = useAuiState((s) => s.composer.canSend);

  return (
    <View style={[styles.shell, { backgroundColor: colors.composer, borderColor: colors.border }]}>
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={text}
        onChangeText={(t) => aui.composer.setText(t)}
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
      <View style={styles.actionRow}>
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

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'column',
    gap: 6,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
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
});
