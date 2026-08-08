import { AppText as Text } from '@/components/ui/text';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AccountType } from '@/lib/account';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type AccountPickerProps = {
  value: AccountType | null;
  onChange: (type: AccountType) => void;
};

const OPTIONS: { type: AccountType; label: string; description: string }[] = [
  {
    type: 'personal',
    label: 'Personal',
    description: 'Send, receive, and track your own money.',
  },
  {
    type: 'business',
    label: 'Business',
    description: 'Invoices, payouts, and team-ready wallets.',
  },
];

export function AccountPicker({ value, onChange }: AccountPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.list}>
      {OPTIONS.map((option) => {
        const selected = value === option.type;
        return (
          <Pressable
            key={option.type}
            accessibilityRole='button'
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.selection();
              onChange(option.type);
            }}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: selected ? colors.foreground : colors.border,
                backgroundColor: selected ? colors.muted : colors.background,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: selected ? colors.foreground : colors.mutedForeground,
                  },
                ]}
              />
              <Text style={[styles.label, { color: colors.foreground }]}>{option.label}</Text>
            </View>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {option.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  description: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    paddingLeft: 14,
  },
});
