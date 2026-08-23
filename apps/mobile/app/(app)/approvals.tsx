import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { ApprovalFilter, ApprovalRequest } from '@/components/approvals/types';

import { ApprovalListItem } from '@/components/approvals/ApprovalListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { listApprovals } from '@/lib/approvals-storage';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

const FILTERS: { id: ApprovalFilter; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function ApprovalsScreen() {
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
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Approvals'
        data={filtered}
        keyExtractor={(item) => item.id}
        intro={
          <>
            <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
              Approvals
            </Text>
            <Text className='pb-3.5 pt-1.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
              Agent-prepared payments and plans waiting for you. Confirm with the same passcode as
              chat.{pendingCount > 0 ? ` ${pendingCount} pending.` : ''}
            </Text>
          </>
        }
        controls={
          <View className='flex-row flex-wrap gap-2 pb-2'>
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    haptics.selection();
                    setFilter(item.id);
                  }}
                  className={cx('rounded-full px-3 py-2', active ? 'bg-foreground' : 'bg-muted')}
                >
                  <Text
                    className={cx(
                      'font-sans-semibold text-sm',
                      active ? 'text-background' : 'text-foreground',
                    )}
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
          <Text className='pt-8 text-center font-sans-medium text-[15px] leading-5 text-muted-foreground'>
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
