import type { BusinessApp } from '@finora/shared';

import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { BusinessAppRow } from '@/components/integrations/BusinessAppRow';
import { useBusinessAppActions } from '@/components/integrations/use-business-app-actions';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { browseBusinessApps } from '@/lib/business-apps-api';

const SEARCH_DEBOUNCE_MS = 300;

/** Every app Finora can connect through Composio, most used first. */
export default function MoreAppsScreen() {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [apps, setApps] = useState<BusinessApp[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignores pages that arrive after the search changed.
  const requestRef = useRef(0);

  const loadPage = useCallback(
    async (query: string, after: string | null) => {
      const request = ++requestRef.current;
      setLoading(true);
      try {
        const page = await browseBusinessApps(getToken, { search: query, cursor: after });
        if (request !== requestRef.current) return;
        setApps((current) => (after ? [...current, ...page.apps] : page.apps));
        setCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        if (request !== requestRef.current) return;
        setError(caught instanceof Error ? caught.message : 'Could not load apps.');
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadPage(search, null), search ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [loadPage, search]);

  // Refresh statuses in place after connecting, keeping the loaded pages.
  const refreshStatuses = useCallback(async () => {
    try {
      const page = await browseBusinessApps(getToken, { search });
      const statuses = new Map(page.apps.map((app) => [app.slug, app.status]));
      setApps((current) =>
        current.map((app) => ({ ...app, status: statuses.get(app.slug) ?? app.status })),
      );
    } catch {
      // Keep the current list; the next search or visit reloads it.
    }
  }, [getToken, search]);

  const { busySlug, connect, manage } = useBusinessAppActions(refreshStatuses);

  return (
    <FlatList
      className='flex-1 bg-background'
      contentInsetAdjustmentBehavior='automatic'
      keyboardShouldPersistTaps='handled'
      keyboardDismissMode='on-drag'
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      data={apps}
      keyExtractor={(app) => app.slug}
      ItemSeparatorComponent={() => <View className='h-px bg-border' />}
      ListHeaderComponent={
        <View className='mb-2 gap-3'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            More apps
          </Text>
          <View
            className='min-h-[48px] flex-row items-center rounded-full border border-border bg-composer px-4'
            style={{ borderCurve: 'continuous' }}
          >
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder='Search apps'
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize='none'
              autoCorrect={false}
              returnKeyType='search'
              clearButtonMode='while-editing'
              className='flex-1 py-0 font-sans-medium text-[16px] text-foreground'
            />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <BusinessAppRow
          app={item}
          busy={busySlug === item.slug}
          onConnect={() => void connect(item)}
          onManage={() => manage(item)}
        />
      )}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (!loading && cursor) void loadPage(search, cursor);
      }}
      ListEmptyComponent={
        loading ? null : (
          <Pressable
            disabled={!error}
            onPress={() => void loadPage(search, null)}
            className='items-center gap-1 py-12 active:opacity-70'
          >
            <Text className='text-center font-sans-medium text-[15px] text-muted-foreground'>
              {error ?? `No apps match "${search}".`}
            </Text>
            {error ? (
              <Text className='font-sans-semibold text-[15px] text-foreground'>Try again</Text>
            ) : null}
          </Pressable>
        )
      }
      ListFooterComponent={
        loading ? (
          <View className='items-center py-6'>
            <LoadingIcon color={colors.mutedForeground} />
          </View>
        ) : null
      }
    />
  );
}
