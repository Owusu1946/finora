import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { Invoice, InvoiceFilter } from '@/components/invoices/types';

import { InvoiceCard } from '@/components/chat/InvoiceCard';
import { InvoiceListItem } from '@/components/invoices/InvoiceListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { listInvoices } from '@/lib/invoices-storage';
import { getCachedRemoteInvoices, getRemoteInvoices, queueInvoiceSync, updateRemoteInvoicePreferences } from '@/lib/invoices-api';

const FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

export default function InvoicesScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  const { colors } = useTheme();
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
      setItems(remote.invoices.map((invoice) => ({
        id: invoice.id,
        vendor: invoice.vendor,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate ?? invoice.receivedAt,
        status: invoice.status,
        source: 'gmail' as const,
        description: invoice.description ?? undefined,
        destination: { kind: 'bank_account' as const, label: 'Gmail source', value: 'Review before paying' },
      })));
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CollapsibleList
        title='Invoices'
        data={filtered}
        intro={
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Invoices</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Supplier bills from Gmail and chat. Pay with the same passcode as sends.
            </Text>
          </>
        }
        controls={
          <View style={styles.controls}>
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
            <View style={styles.rangeRow}>
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
                  style={[styles.rangeButton, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.foreground }}>{days === '365' ? 'This year' : `${days} days`}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setRangeModal(true)} style={[styles.rangeButton, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground }}>Custom</Text>
              </Pressable>
            </View>
            {syncStatus ? <Text style={[styles.syncStatus, { color: colors.mutedForeground }]}>Gmail: {syncStatus}</Text> : null}
          </View>
        }
        keyExtractor={(item) => item.id}
        onRefresh={refresh}
        refreshing={loading}
        empty={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No invoices here. Try “Find unpaid invoices” in chat after connecting Gmail.
          </Text>
        }
        renderItem={renderInvoice}
      />

      <Modal visible={rangeModal} animationType='slide' transparent onRequestClose={() => setRangeModal(false)}>
        <View style={[styles.rangeModal, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invoice date range</Text>
          <TextInput
            value={range.startDate}
            onChangeText={(value) => setRange((current) => ({ ...current, startDate: value }))}
            placeholder='Start date: YYYY-MM-DD'
            style={[styles.dateInput, { borderColor: colors.border, color: colors.foreground }]}
          />
          <TextInput
            value={range.endDate}
            onChangeText={(value) => setRange((current) => ({ ...current, endDate: value }))}
            placeholder='End date: YYYY-MM-DD'
            style={[styles.dateInput, { borderColor: colors.border, color: colors.foreground }]}
          />
          <Pressable
            onPress={() => {
              setRangeModal(false);
              void updateRemoteInvoicePreferences(getTokenRef.current, range)
                .then(() => queueInvoiceSync(getTokenRef.current))
                .then(refresh)
                .catch((error) =>
                  Alert.alert('Could not update date range', error instanceof Error ? error.message : 'Try again.'),
                );
            }}
            style={[styles.applyButton, { backgroundColor: colors.foreground }]}
          >
            <Text style={{ color: colors.background, fontWeight: '600' }}>Apply</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={selected != null}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setSelected(null)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Pay invoice</Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                setSelected(null);
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Close</Text>
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
    marginTop: 6,
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
  controls: {
    gap: 8,
    paddingBottom: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  syncStatus: {
    fontSize: 12,
    fontWeight: '500',
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
  modal: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 19,
    fontWeight: '600',
  },
  rangeModal: {
    marginTop: 'auto',
    padding: 20,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  dateInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  applyButton: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
