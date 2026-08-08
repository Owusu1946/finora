import type { ReactNode } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export function WizardChip({
  label,
  selected,
  onPress,
  subtle,
  leading,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  subtle?: boolean;
  /** Optional leading node (e.g. circular CurrencyIcon). */
  leading?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.foreground : colors.muted,
          borderColor: selected ? colors.foreground : colors.border,
          opacity: subtle && !selected ? 0.85 : 1,
        },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <Text style={[styles.label, { color: selected ? colors.background : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WizardStepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.progress, { color: colors.mutedForeground }]}>
        Step {step} of {total}
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < step ? colors.foreground : colors.border,
                width: i === step - 1 ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  leading: {
    marginLeft: -2,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  progress: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
