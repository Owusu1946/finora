import { BranchPickerPrimitive, useAuiState } from '@assistant-ui/react-native';
import { View, StyleSheet } from 'react-native';

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
    <View style={[styles.container, { justifyContent: align }]}>
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
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  button: {
    padding: 4,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
