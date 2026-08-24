import { LegendList } from '@legendapp/list/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountBadge, HeaderTitleWithAccount } from '@/components/shell/account-badge';

type Row<Item> =
  | { kind: 'intro' }
  | { kind: 'controls' }
  | { kind: 'empty' }
  | { kind: 'item'; item: Item };

const bodyTitleTopGap = 16;

function HeaderBackground() {
  return <View className='absolute inset-0 bg-background' />;
}

export function CollapsibleList<Item>({
  title,
  data,
  intro,
  controls,
  empty,
  renderItem,
  keyExtractor,
  getItemType,
  onRefresh,
  refreshing,
}: {
  title: string;
  data: Item[];
  intro: ReactNode;
  controls: ReactNode;
  empty?: ReactNode;
  renderItem: (item: Item, index: number, isLast: boolean) => ReactNode;
  keyExtractor: (item: Item) => string;
  getItemType?: (item: Item) => string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextCollapsed = event.nativeEvent.contentOffset.y >= bodyTitleTopGap;
    if (nextCollapsed === collapsedRef.current) return;

    collapsedRef.current = nextCollapsed;
    setCollapsed(nextCollapsed);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTitle: () => (collapsed ? <HeaderTitleWithAccount title={title} /> : <AccountBadge />),
      headerBackground: () => <HeaderBackground />,
    });
  }, [collapsed, navigation, title]);

  const rows = useMemo<Row<Item>[]>(
    () => [
      { kind: 'intro' },
      { kind: 'controls' },
      ...(data.length > 0
        ? data.map((item) => ({ kind: 'item' as const, item }))
        : empty
          ? [{ kind: 'empty' as const }]
          : []),
    ],
    [data, empty],
  );

  const renderRow = useCallback(
    ({ item, index }: { item: Row<Item>; index: number }) => {
      if (item.kind === 'intro') return <View className='px-5'>{intro}</View>;
      if (item.kind === 'controls') {
        return <View className='bg-background px-5 pt-0.5'>{controls}</View>;
      }
      if (item.kind === 'empty') return <View className='px-5'>{empty}</View>;
      return (
        <View className='px-5'>{renderItem(item.item, index - 2, index === rows.length - 1)}</View>
      );
    },
    [controls, empty, intro, renderItem, rows.length],
  );

  return (
    <LegendList
      data={rows}
      extraData={controls}
      renderItem={renderRow}
      keyExtractor={(row, index) =>
        row.kind === 'item' ? keyExtractor(row.item) : `${row.kind}-${index}`
      }
      getItemType={(row) => (row.kind === 'item' ? (getItemType?.(row.item) ?? 'item') : row.kind)}
      recycleItems
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: headerHeight + bodyTitleTopGap,
        paddingBottom: headerHeight + bodyTitleTopGap,
      }}
      contentInsetAdjustmentBehavior='never'
      stickyHeaderIndices={[1]}
      stickyHeaderConfig={{ offset: headerHeight }}
      renderScrollComponent={(props) => <Animated.ScrollView {...props} />}
      onScroll={handleScroll}
      onRefresh={onRefresh}
      refreshing={refreshing}
      // Keep the native refresh spinner below the status-bar/notch area.
      progressViewOffset={headerHeight + insets.top + 8}
    />
  );
}
