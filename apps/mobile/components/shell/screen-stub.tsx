import { Text, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ScreenStubProps = {
  title: string;
  description: string;
};

export function ScreenStub({ title, description }: ScreenStubProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    maxWidth: 340,
  },
});
