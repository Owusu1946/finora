import { BranchPickerPrimitive, useAuiState } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

export function MessageBranchPicker({
  align = 'flex-start',
}: {
  align?: 'flex-start' | 'flex-end';
}) {
  const { colors } = useTheme();
  const branchNumber = useAuiState((s) => s.message.branchNumber);
  const branchCount = useAuiState((s) => s.message.branchCount);

  if (branchCount <= 1) return null;

  return (
    <View
      className='flex-row items-center gap-0.5'
      style={[{ justifyContent: align }]}
    >
      <BranchPickerPrimitive.Previous
        style={[styles.button, { opacity: branchNumber <= 1 ? 0.35 : 1 }]}
        hitSlop={4}
      >
        <Icon
          name='chevron-left'
          size={16}
          color={colors.mutedForeground}
        />
      </BranchPickerPrimitive.Previous>
      <Text
        className='font-sans text-[13px] text-muted-foreground'
        style={[styles.label]}
      >
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </Text>
      <BranchPickerPrimitive.Next
        style={[styles.button, { opacity: branchNumber >= branchCount ? 0.35 : 1 }]}
        hitSlop={4}
      >
        <Icon
          name='chevron-right'
          size={16}
          color={colors.mutedForeground}
        />
      </BranchPickerPrimitive.Next>
    </View>
  );
}

const styles = {
  button: {
    padding: 4,
  },
  label: {
    fontVariant: ['tabular-nums'],
  },
};
