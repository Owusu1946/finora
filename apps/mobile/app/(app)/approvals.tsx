import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ApprovalListItem } from '@/components/approvals/ApprovalListItem';
import type { ApprovalFilter, ApprovalRequest } from '@/components/approvals/types';
import { useTheme } from '@/hooks/use-theme';
import { listApprovals } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';

const FILTERS: { id: ApprovalFilter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function ApprovalsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<ApprovalFilter>('pending');
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listApprovals();
    setItems(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((a) => a.status === filter);
  }, [filter, items]);

  const pendingCount = items.filter((a) => a.status === 'pending').length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Approvals</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Agent-prepared payments and plans waiting for you. Confirm with the same passcode as
        chat.
        {pendingCount > 0 ? ` ${pendingCount} pending.` : ''}
      </Text>

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                haptics.selection();
                setFilter(item.id);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.foreground : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? colors.background : colors.foreground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {filter === 'pending'
              ? 'No pending agent payments. Ask Claude or ChatGPT via MCP to prepare one.'
              : 'Nothing in this filter yet.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <ApprovalListItem
            approval={item}
            isLast={index === filtered.length - 1}
            onPress={(approval) => {
              router.push(`/approval/${approval.id}` as Href);
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 32,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
