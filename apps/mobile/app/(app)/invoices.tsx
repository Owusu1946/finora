import { useAuth } from '@clerk/expo';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import type { Invoice, InvoiceFilter } from '@/components/invoices/types';

import { InvoiceCard } from '@/components/chat/InvoiceCard';
import { InvoiceListItem } from '@/components/invoices/InvoiceListItem';
import { invoiceFromRemote } from '@/components/invoices/types';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import {
  getCachedRemoteInvoices,
  getRemoteInvoices,
  queueInvoiceSync,
  updateRemoteInvoicePreferences,
} from '@/lib/invoices-api';
import { listInvoices } from '@/lib/invoices-storage';

const FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

export default function InvoicesScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  const router = useRouter();
  const [filter, setFilter] = useState<InvoiceFilter>('due');
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [range, setRange] = useState({ startDate: '', endDate: '', timezone: 'UTC' });
  const [rangeModal, setRangeModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const mapRemote = (remote: Awaited<ReturnType<typeof getRemoteInvoices>>) => {
      setRange(remote.preferences);
      setSyncStatus(remote.syncStatus);
      setItems(remote.invoices.map(invoiceFromRemote));
    };
    const cached = await getCachedRemoteInvoices();
    if (cached) {
      mapRemote(cached);
      setLoading(false);
    }
    try {
      const remote = await getRemoteInvoices(getTokenRef.current);
      mapRemote(remote);
    } catch {
      const next = await listInvoices();
      setItems(next.filter((i) => i.status !== 'dismissed' || filter === 'all'));
      setSyncStatus('offline');
    }
    setLoading(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items.filter((i) => i.status !== 'dismissed');
    return items.filter((i) => i.status === filter);
  }, [filter, items]);
  const handleInvoicePress = useCallback(
    (invoice: Invoice) => {
      if (invoice.status === 'due') {
        setSelected(invoice);
        return;
      }
      if (invoice.transactionId) {
        router.push(`/transaction/${invoice.transactionId}` as Href);
      }
    },
    [router],
  );
  const renderInvoice = useCallback(
    (item: Invoice, _index: number, isLast: boolean) => (
      <InvoiceListItem
        invoice={item}
        isLast={isLast}
        onPress={handleInvoicePress}
      />
    ),
    [filtered.length, handleInvoicePress],
  );

  return (
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Invoices'
        data={filtered}
        intro={
          <>
            <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
              Invoices
            </Text>
            <Text className='mb-0 mt-1.5 pb-3.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
              Supplier bills from Gmail and chat. Pay with the same passcode as sends.
            </Text>
          </>
        }
        controls={
          <View className='gap-2 pb-2'>
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
            <View className='flex-row flex-wrap gap-2'>
              {['30', '90', '365'].map((days) => (
                <Pressable
                  key={days}
                  onPress={() => {
                    const end = new Date();
                    const start = new Date(end);
                    if (days === '365') start.setMonth(0, 1);
                    else start.setDate(start.getDate() - Number(days) + 1);
                    const next = {
                      startDate: start.toISOString().slice(0, 10),
                      endDate: end.toISOString().slice(0, 10),
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                    };
                    setRange(next);
                    void updateRemoteInvoicePreferences(getTokenRef.current, next)
                      .then(() => queueInvoiceSync(getTokenRef.current))
                      .then(refresh)
                      .catch(() => undefined);
                  }}
                  className='rounded-lg border border-border px-2.5 py-2'
                >
                  <Text className='text-foreground'>
                    {days === '365' ? 'This year' : `${days} days`}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setRangeModal(true)}
                className='rounded-lg border border-border px-2.5 py-2'
              >
                <Text className='text-foreground'>Custom</Text>
              </Pressable>
            </View>
            {syncStatus ? (
              <Text className='font-sans-medium text-xs text-muted-foreground'>
                Gmail: {syncStatus}
              </Text>
            ) : null}
          </View>
        }
        keyExtractor={(item) => item.id}
        onRefresh={refresh}
        refreshing={loading}
        empty={
          <Text className='pt-8 text-center font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            No invoices here. Try “Find unpaid invoices” in chat after connecting Gmail.
          </Text>
        }
        renderItem={renderInvoice}
      />

      <SheetModal
        visible={rangeModal}
        onClose={() => setRangeModal(false)}
        keyboardAvoiding
      >
        <ScrollView
          contentContainerStyle={{ marginTop: 'auto', gap: 12, padding: 20 }}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <Text className='font-sans-semibold text-[19px] text-foreground'>Invoice date range</Text>
          <TextInput
            value={range.startDate}
            onChangeText={(value) => setRange((current) => ({ ...current, startDate: value }))}
            placeholder='Start date: YYYY-MM-DD'
            className='rounded-lg border border-border p-3 text-base text-foreground'
          />
          <TextInput
            value={range.endDate}
            onChangeText={(value) => setRange((current) => ({ ...current, endDate: value }))}
            placeholder='End date: YYYY-MM-DD'
            className='rounded-lg border border-border p-3 text-base text-foreground'
          />
          <Pressable
            onPress={() => {
              setRangeModal(false);
              void updateRemoteInvoicePreferences(getTokenRef.current, range)
                .then(() => queueInvoiceSync(getTokenRef.current))
                .then(refresh)
                .catch((error) =>
                  Alert.alert(
                    'Could not update date range',
                    error instanceof Error ? error.message : 'Try again.',
                  ),
                );
            }}
            className='min-h-[46px] items-center justify-center rounded-[10px] bg-foreground'
          >
            <Text className='font-sans-semibold text-background'>Apply</Text>
          </Pressable>
        </ScrollView>
      </SheetModal>

      <Modal
        visible={selected != null}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setSelected(null)}
      >
        <View className='flex-1 bg-background px-5 pt-5'>
          <View className='mb-2 flex-row items-center justify-between'>
            <Text className='font-sans-semibold text-[19px] text-foreground'>Pay invoice</Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                setSelected(null);
              }}
            >
              <Text className='font-sans-semibold text-muted-foreground'>Close</Text>
            </Pressable>
          </View>
          {selected ? (
            <InvoiceCard
              invoice={selected}
              onUpdated={(next) => {
                setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
                if (next.status === 'paid' || next.status === 'dismissed') {
                  setTimeout(() => setSelected(null), 600);
                }
              }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
