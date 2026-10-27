import { ThreadListItemPrimitive, useAui, useAuiState } from '@assistant-ui/react-native';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

export const ThreadListItem = memo(function ThreadListItem({
  onSelect,
}: {
  onSelect: (switchTo: () => void) => void;
}) {
  const aui = useAui();
  const { colors } = useTheme();
  const isActive = useAuiState((s) => s.threads.mainThreadId === s.threadListItem.id);

  return (
    <ThreadListItemPrimitive.Root className='mx-2 flex-row items-center'>
      <Pressable
        onPressIn={haptics.selection}
        onPress={() => {
          onSelect(() => aui.threadListItem.switchTo());
        }}
        className={cx(
          'h-[38px] flex-1 justify-center rounded-[18px] px-3 active:bg-muted',
          isActive && 'bg-muted',
        )}
      >
        <Text
          numberOfLines={1}
          className={cx(
            'text-base tracking-[-0.2px] text-foreground',
            isActive ? 'font-sans-semibold' : 'font-sans',
          )}
        >
          <ThreadListItemPrimitive.Title fallback='New chat' />
        </Text>
      </Pressable>
      <ThreadListItemPrimitive.Delete
        accessibilityLabel='Delete chat'
        onPressIn={haptics.selection}
        hitSlop={6}
        className='ml-1 h-7 w-7 items-center justify-center rounded-full active:bg-muted'
      >
        <Icon
          name='close-circle'
          size={16}
          color={colors.mutedForeground}
        />
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  );
});
