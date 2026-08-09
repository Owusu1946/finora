import { ThreadListItemPrimitive, useAui, useAuiState } from '@assistant-ui/react-native';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export const ThreadListItem = memo(function ThreadListItem({ onSelect }: { onSelect: () => void }) {
  const { colors } = useTheme();
  const aui = useAui();
  const isActive = useAuiState((s) => s.threads.mainThreadId === s.threadListItem.id);

  return (
    <ThreadListItemPrimitive.Root>
      <Pressable
        onPressIn={haptics.selection}
        onPress={() => {
          aui.threadListItem.switchTo();
          onSelect();
        }}
        style={({ pressed }) => [
          styles.item,
          (isActive || pressed) && { backgroundColor: colors.muted },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: colors.foreground,
              fontWeight: isActive ? '600' : '400',
            },
          ]}
        >
          <ThreadListItemPrimitive.Title fallback='New chat' />
        </Text>
      </Pressable>
    </ThreadListItemPrimitive.Root>
  );
});

const styles = StyleSheet.create({
  item: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: Radius.md,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
