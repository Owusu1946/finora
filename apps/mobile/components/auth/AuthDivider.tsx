import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function AuthDivider() {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>or</Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
});
