import { ThreadListItemPrimitive, useAui, useAuiState } from '@assistant-ui/react-native';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

export const ThreadListItem = memo(function ThreadListItem({
  onSelect,
}: {
  onSelect: (switchTo: () => void) => void;
}) {
  const aui = useAui();
  const isActive = useAuiState((s) => s.threads.mainThreadId === s.threadListItem.id);

  return (
    <ThreadListItemPrimitive.Root>
      <Pressable
        onPressIn={haptics.selection}
        onPress={() => {
          onSelect(() => aui.threadListItem.switchTo());
        }}
        className={cx(
          'mx-2 h-[38px] justify-center rounded-[18px] px-3 active:bg-muted',
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
    </ThreadListItemPrimitive.Root>
  );
});
