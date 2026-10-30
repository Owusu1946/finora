import { BUSINESS_APP_CATEGORIES, type BusinessApp } from '@finora/shared';

import { useAuth } from '@clerk/expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { listBusinessApps } from '@/lib/business-apps-api';
import { haptics } from '@/lib/haptics';

import { BusinessAppRow } from './BusinessAppRow';
import { useBusinessAppActions } from './use-business-app-actions';

/** Curated business apps grouped by job, with a link to every other app. */
export function BusinessAppsSection() {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [apps, setApps] = useState<BusinessApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setApps(await listBusinessApps(getToken));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your apps.');
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { busySlug, connect, manage } = useBusinessAppActions(load);

  return (
    <View className='mt-4 gap-3'>
      <View className='gap-1'>
        <Text className='font-sans-semibold text-[20px] tracking-[-0.3px] text-foreground'>
          Business apps
        </Text>
        <Text className='font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Connect the tools your business runs on. Finora reads them and drafts messages; it never
          moves money in them.
        </Text>
      </View>

      {apps === null ? (
        <View className='min-h-[120px] items-center justify-center rounded-[26px] border border-border bg-composer'>
          {error ? (
            <Pressable
              onPress={() => void load()}
              className='items-center gap-1 px-6 active:opacity-70'
            >
              <Text className='text-center font-sans-medium text-[14px] text-muted-foreground'>
                {error}
              </Text>
              <Text className='font-sans-semibold text-[14px] text-foreground'>Try again</Text>
            </Pressable>
          ) : (
            <LoadingIcon color={colors.mutedForeground} />
          )}
        </View>
      ) : (
        BUSINESS_APP_CATEGORIES.map((category) => {
          const group = apps.filter((app) => app.category === category.id);
          if (group.length === 0) return null;
          return (
            <View
              key={category.id}
              className='gap-1'
            >
              <Text className='px-1 font-sans-semibold text-[13px] uppercase tracking-[0.4px] text-muted-foreground'>
                {category.title}
              </Text>
              <View
                className='rounded-[26px] border border-border bg-composer px-4 py-1'
                style={{ borderCurve: 'continuous' }}
              >
                {group.map((app, index) => (
                  <Fragment key={app.slug}>
                    {index > 0 ? <View className='h-px bg-border' /> : null}
                    <BusinessAppRow
                      app={app}
                      busy={busySlug === app.slug}
                      onConnect={() => void connect(app)}
                      onManage={() => manage(app)}
                    />
                  </Fragment>
                ))}
              </View>
            </View>
          );
        })
      )}

      <Pressable
        accessibilityRole='button'
        onPress={() => {
          haptics.selection();
          router.push('/apps');
        }}
        className='min-h-[56px] flex-row items-center gap-3 rounded-[26px] border border-border bg-composer px-4 active:opacity-75'
        style={{ borderCurve: 'continuous' }}
      >
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[15px] text-foreground'>More apps</Text>
          <Text className='font-sans text-[13px] text-muted-foreground'>
            Browse and search every app you can connect
          </Text>
        </View>
        <Icon
          name='chevron-right'
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}
