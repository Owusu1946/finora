import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Contact, ContactFilter } from '@/components/contacts/types';

import { ContactListItem } from '@/components/contacts/ContactListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { listContacts } from '@/lib/contacts-storage';
import { cx } from '@/lib/cx';
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
  const handleContactPress = useCallback(() => {
    router.push('/(app)');
  }, [router]);
  const renderContact = useCallback(
    (item: Contact, index: number, isLast: boolean) => (
      <ContactListItem
        contact={item}
        index={index}
        isLast={isLast}
        onPress={handleContactPress}
      />
    ),
    [filtered.length, handleContactPress],
  );

  return (
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Contacts'
        data={filtered}
        intro={
          <>
            <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
              Contacts
            </Text>
            <Text className='mb-0 mt-1.5 pb-3.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
              Recipients you’ve paid — save more from chat after sending.
            </Text>
          </>
        }
        controls={
          <View className='flex-row gap-2 pb-2'>
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
        keyExtractor={(item) => item.id}
        onRefresh={refresh}
        refreshing={loading}
        empty={
          loading ? (
            <LoadingIcon
              style={{ marginTop: 24 }}
              color={colors.mutedForeground}
            />
          ) : (
            <Text className='pt-8 text-center font-sans-medium text-[15px] leading-5 text-muted-foreground'>
              No contacts yet. Send money in chat, then tap Save contact.
            </Text>
          )
        }
        renderItem={renderContact}
      />
    </View>
  );
}
