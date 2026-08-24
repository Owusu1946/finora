import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

export type FilterCategory = 'all' | 'fiat' | 'crypto' | 'momo';

interface WalletFilterTabsProps {
  filter: FilterCategory;
  onSelectFilter: (f: FilterCategory) => void;
  onOpenAddWallet: () => void;
}

export function WalletFilterTabs({
  filter,
  onSelectFilter,
  onOpenAddWallet,
}: WalletFilterTabsProps) {
  const { colors } = useTheme();

  const categories: FilterCategory[] = ['all', 'fiat', 'crypto', 'momo'];
  const categoryTitles: Record<FilterCategory, string> = {
    all: 'All',
    fiat: 'Fiat',
    crypto: 'Crypto',
    momo: 'Mobile Money',
  };

  return (
    <View className='flex-row items-center justify-between border-b border-[rgba(150,150,150,0.15)] pb-1'>
      <View className='flex-row gap-4'>
        {categories.map((t) => {
          const isActive = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                haptics.selection();
                onSelectFilter(t);
              }}
              className='border-b-2 border-transparent py-1.5'
              style={isActive ? { borderBottomColor: colors.foreground } : undefined}
            >
              <Text
                className={cx('text-sm', isActive ? 'font-sans-semibold' : 'font-sans-medium')}
                style={{ color: isActive ? colors.foreground : colors.mutedForeground }}
              >
                {categoryTitles[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          haptics.selection();
          onOpenAddWallet();
        }}
        hitSlop={6}
        className='p-1'
      >
        <Icon
          name='add'
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}
