import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { Invoice, InvoiceFilter } from '@/components/invoices/types';

import { InvoiceCard } from '@/components/chat/InvoiceCard';
import { InvoiceListItem } from '@/components/invoices/InvoiceListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { listInvoices } from '@/lib/invoices-storage';

const FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<InvoiceFilter>('due');
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listInvoices();
    setItems(next.filter((i) => i.status !== 'dismissed' || filter === 'all'));
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
});
