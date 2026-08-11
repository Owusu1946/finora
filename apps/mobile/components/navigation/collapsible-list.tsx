import { LegendList } from '@legendapp/list/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { BlurView } from 'expo-blur';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountBadge, HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { useTheme } from '@/hooks/use-theme';

type Row<Item> =
  | { kind: 'intro' }
  | { kind: 'controls' }
  | { kind: 'empty' }
  | { kind: 'item'; item: Item };

function CollapsedHeaderBackground({ visible }: { visible: boolean }) {
  const { colors, isDark } = useTheme();
  if (!visible) return null;

  const fill = (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.72)' : 'rgba(255, 255, 255, 0.72)',
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    />
  );

  return (
    <BlurView
      tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
      intensity={86}
      experimentalBlurMethod='dimezisBlurView'
      style={StyleSheet.absoluteFill}
    >
      {fill}
    </BlurView>
  );
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
  const { colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [collapsed, setCollapsed] = useState(false);
  const didScroll = useRef(false);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y <= 1) {
      didScroll.current = false;
      setCollapsed(false);
    } else {
      didScroll.current = true;
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTitle: () => (collapsed ? <HeaderTitleWithAccount title={title} /> : <AccountBadge />),
      headerBackground: () => <CollapsedHeaderBackground visible={collapsed} />,
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
      if (item.kind === 'intro') return <View style={styles.intro}>{intro}</View>;
      if (item.kind === 'controls') {
        return (
          <View style={[styles.controls, { backgroundColor: colors.background }]}>{controls}</View>
        );
      }
      if (item.kind === 'empty') return <View style={styles.empty}>{empty}</View>;
      return (
        <View style={styles.item}>
          {renderItem(item.item, index - 2, index === rows.length - 1)}
        </View>
      );
    },
    [colors.background, controls, empty, intro, renderItem, rows.length],
  );

  return (
    <LegendList
      key={isDark ? 'collapsible-list-dark' : 'collapsible-list-light'}
      data={rows}
      renderItem={renderRow}
      keyExtractor={(row, index) =>
        row.kind === 'item' ? keyExtractor(row.item) : `${row.kind}-${index}`
      }
      getItemType={(row) => (row.kind === 'item' ? (getItemType?.(row.item) ?? 'item') : row.kind)}
      recycleItems
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.list,
        { paddingTop: headerHeight + 16, paddingBottom: headerHeight + 16 },
      ]}
      contentInsetAdjustmentBehavior='never'
      stickyHeaderIndices={[1]}
      stickyHeaderConfig={{ offset: headerHeight }}
      renderScrollComponent={(props) => <Animated.ScrollView {...props} />}
      onScroll={handleScroll}
      onStickyHeaderChange={({ index }) => {
        if (didScroll.current) setCollapsed(index === 1);
      }}
      onRefresh={onRefresh}
      refreshing={refreshing}
      // Keep the native refresh spinner below the status-bar/notch area.
      progressViewOffset={headerHeight + insets.top + 8}
    />
  );
}

const styles = StyleSheet.create({
  list: {},
  intro: { paddingHorizontal: 20 },
  controls: { paddingHorizontal: 20, paddingTop: 2 },
  empty: { paddingHorizontal: 20 },
  item: { paddingHorizontal: 20 },
});
