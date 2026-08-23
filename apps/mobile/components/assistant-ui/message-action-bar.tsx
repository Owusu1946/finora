import { ActionBarPrimitive, AuiIf, useAui } from '@assistant-ui/react-native';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const copyToClipboard = async (text: string) => {
  await Clipboard.setStringAsync(text);
};

function FeedbackButton({ type }: { type: 'positive' | 'negative' }) {
  const { colors } = useTheme();
  const aui = useAui();
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handlePress = () => {
    haptics.selection();
    const nextState = submitted === type ? null : type;
    setSubmitted(nextState);

    try {
      aui.message.submitFeedback({ type });
    } catch {
      // Gracefully handled by local state
    }
  };

  const isSubmitted = submitted === type;
  const isPositive = type === 'positive';

  return (
    <Pressable
      accessibilityLabel={isPositive ? 'Helpful response' : 'Unhelpful response'}
      onPress={handlePress}
      className='p-1.5'
      style={({ pressed }) => [pressed && { backgroundColor: colors.muted }]}
    >
      <Icon
        name={isPositive ? 'thumb-up' : 'thumb-down'}
        size={16}
        color={
          isSubmitted ? (isPositive ? colors.primary : colors.destructive) : colors.mutedForeground
        }
      />
    </Pressable>
  );
}

export function MessageActionBar() {
  const { colors } = useTheme();

  const buttonStyle = ({ pressed }: { pressed: boolean }) => [
    styles.button,
    pressed && { backgroundColor: colors.muted },
  ];

  return (
    <View className='flex-row items-center gap-0.5'>
      <ActionBarPrimitive.Copy
        copyToClipboard={copyToClipboard}
        onPressIn={haptics.selection}
        style={buttonStyle}
      >
        {({ isCopied }) => (
          <Icon
            name={isCopied ? 'check' : 'copy'}
            size={16}
            color={isCopied ? colors.foreground : colors.mutedForeground}
          />
        )}
      </ActionBarPrimitive.Copy>

      {/* User message actions */}
      <AuiIf condition={(s) => s.message.role === 'user'}>
        <ActionBarPrimitive.Edit
          onPressIn={haptics.selection}
          style={buttonStyle}
        >
          <Icon
            name='edit'
            size={16}
            color={colors.mutedForeground}
          />
        </ActionBarPrimitive.Edit>
      </AuiIf>

      {/* Assistant message actions */}
      <AuiIf condition={(s) => s.message.role === 'assistant'}>
        <ActionBarPrimitive.Reload
          onPressIn={haptics.selection}
          style={buttonStyle}
        >
          <Icon
            name='reload'
            size={16}
            color={colors.mutedForeground}
          />
        </ActionBarPrimitive.Reload>

        <FeedbackButton type='positive' />
        <FeedbackButton type='negative' />
      </AuiIf>
    </View>
  );
}

const styles = {
  button: {
    borderRadius: Radius.sm,
  },
};
