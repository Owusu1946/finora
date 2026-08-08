import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
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
    <View style={styles.filterSection}>
      <View style={styles.filterBar}>
        {categories.map((t) => {
          const isActive = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                haptics.selection();
                onSelectFilter(t);
              }}
              style={[styles.filterTab, isActive && { borderBottomColor: colors.foreground }]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: isActive ? colors.foreground : colors.mutedForeground,
                  },
                  isActive && styles.filterTabActiveText,
                ]}
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
        style={styles.addInlineBtn}
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

const styles = StyleSheet.create({
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.15)',
    paddingBottom: 4,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 16,
  },
  filterTab: {
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  filterTabActiveText: {
    fontWeight: '600',
  },
  addInlineBtn: {
    padding: 4,
  },
});
