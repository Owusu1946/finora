import { AppText as Text } from '@/components/ui/text';
import { StyleSheet, View, Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import type { ActivityFilter } from './types';

const TABS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
  { key: 'swap', label: 'Swaps' },
];

interface ActivityFilterTabsProps {
  filter: ActivityFilter;
  onSelectFilter: (f: ActivityFilter) => void;
}

export function ActivityFilterTabs({ filter, onSelectFilter }: ActivityFilterTabsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = filter === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              haptics.selection();
              onSelectFilter(t.key);
            }}
            style={[styles.tab, active && { borderBottomColor: colors.foreground }]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.foreground : colors.mutedForeground },
                active && styles.labelActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.15)',
    paddingBottom: 4,
  },
  tab: {
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
});
