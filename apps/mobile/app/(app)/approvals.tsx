import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ApprovalFilter, ApprovalRequest } from '@/components/approvals/types';

import { ApprovalListItem } from '@/components/approvals/ApprovalListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
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
  const handleApprovalPress = useCallback(
    (approval: ApprovalRequest) => {
      router.push(`/approval/${approval.id}` as Href);
    },
    [router],
  );
  const renderApproval = useCallback(
    (item: ApprovalRequest, _index: number, isLast: boolean) => (
      <ApprovalListItem
        approval={item}
        isLast={isLast}
        onPress={handleApprovalPress}
      />
    ),
    [filtered.length, handleApprovalPress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CollapsibleList
        title='Approvals'
        data={filtered}
        keyExtractor={(item) => item.id}
        intro={
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Approvals</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Agent-prepared payments and plans waiting for you. Confirm with the same passcode as
              chat.{pendingCount > 0 ? ` ${pendingCount} pending.` : ''}
            </Text>
          </>
        }
        controls={
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
                    { backgroundColor: active ? colors.foreground : colors.muted },
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
        }
        onRefresh={refresh}
        refreshing={loading}
        empty={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {filter === 'pending'
              ? 'No pending agent payments. Ask Claude or ChatGPT via MCP to prepare one.'
              : 'Nothing in this filter yet.'}
          </Text>
        }
        renderItem={renderApproval}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    paddingTop: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    paddingBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    paddingTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
