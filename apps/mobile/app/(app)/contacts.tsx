import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Contact, ContactFilter } from '@/components/contacts/types';

import { ContactListItem } from '@/components/contacts/ContactListItem';
import { useTheme } from '@/hooks/use-theme';
import { listContacts } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';

const FILTERS: { id: ContactFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'recent', label: 'Recent' },
];

export default function ContactsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContactFilter>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listContacts();
    setContacts(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'favourites') return contacts.filter((c) => c.favourite);
    if (filter === 'recent') {
      return [...contacts]
        .filter((c) => c.lastTxDate)
        .sort((a, b) => (b.lastTxDate ?? '').localeCompare(a.lastTxDate ?? ''));
    }
    return contacts;
  }, [contacts, filter]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Contacts</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Recipients you’ve paid — save more from chat after sending.
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

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 24 }}
          color={colors.mutedForeground}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No contacts yet. Send money in chat, then tap Save contact.
            </Text>
          }
          renderItem={({ item, index }) => (
            <ContactListItem
              contact={item}
              index={index}
              isLast={index === filtered.length - 1}
              onPress={(contact) => {
                router.push('/(app)');
                // Chat will pick up a pay-by-name prompt next when wired; for now land in chat.
                void contact;
              }}
            />
          )}
        />
      )}
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 32,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
