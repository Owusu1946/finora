import { View, Pressable } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
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
  return (
    <View className='flex-row gap-4 border-b border-white/15 pb-1'>
      {TABS.map((t) => {
        const active = filter === t.key;
        return (
          <Pressable
            key={t.key}
            accessibilityRole='tab'
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.selection();
              onSelectFilter(t.key);
            }}
            className={cx('border-b-2 border-transparent pb-2 pt-2', active && 'border-foreground')}
          >
            <Text
              className={cx(
                'font-sans text-[15px]',
                active
                  ? 'font-sans-semibold text-foreground'
                  : 'font-sans-medium text-muted-foreground',
              )}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
