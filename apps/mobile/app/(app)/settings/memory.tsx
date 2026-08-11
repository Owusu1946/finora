import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  clearMemories,
  forgetMemory,
  getMemoryStore,
  memoryKindLabel,
  setMemoryEnabled,
  type FinoraMemory,
  type MemoryStore,
} from '@/lib/memory-storage';

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MemorySettingsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<MemoryStore>({ enabled: true, items: [] });

  const refresh = useCallback(async () => {
    const next = await getMemoryStore();
    setStore(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleToggle = async (enabled: boolean) => {
    const next = await setMemoryEnabled(enabled);
    setStore(next);
    haptics.selection();
  };

  const handleForget = (item: FinoraMemory) => {
    Alert.alert('Forget memory', `Remove “${item.title}” from Finora’s memory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          const next = await forgetMemory(item.id);
          setStore(next);
          haptics.success();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (store.items.length === 0) return;
    Alert.alert(
      'Clear all memories',
      'Finora will forget learned preferences, contacts, and notes on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            const next = await clearMemories();
            setStore(next);
            haptics.success();
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection
        title='Assistant memory'
        footer={
          store.enabled
            ? 'Finora can remember preferences and frequent recipients across chats.'
            : 'Memory is off. Finora won’t store new facts until you turn it back on.'
        }
      >
        <SettingsSwitchRow
          label='Remember across chats'
          detail='Learned prefs stay on this device'
          icon='brain'
          value={store.enabled}
          onValueChange={(v) => void handleToggle(v)}
          isLast
        />
      </SettingsSection>

      <SettingsSection
        title={store.items.length > 0 ? `Saved (${store.items.length})` : 'Saved'}
        footer={
          store.items.length === 0
            ? 'Nothing saved yet. Facts appear here when Finora learns something useful.'
            : undefined
        }
      >
        {store.items.length === 0 ? (
          <View style={styles.empty}>
            <Icon
              name='brain'
              size={22}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No memories</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Ask Finora to remember a preference, or keep chatting — useful details show up here.
            </Text>
          </View>
        ) : (
          store.items.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => handleForget(item)}
              style={({ pressed }) => [
                styles.memoryRow,
                index < store.items.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.kindChip, { backgroundColor: colors.muted }]}>
                <Text style={[styles.kindText, { color: colors.mutedForeground }]}>
                  {memoryKindLabel(item.kind)}
                </Text>
              </View>
              <View style={styles.memoryMeta}>
                <Text style={[styles.memoryTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text
                  style={[styles.memoryDetail, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {item.detail}
                </Text>
                <Text style={[styles.memoryWhen, { color: colors.mutedForeground }]}>
                  Updated {relativeDay(item.updatedAt)}
                </Text>
              </View>
              <Icon
                name='remove'
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))
        )}
      </SettingsSection>

      {store.items.length > 0 ? (
        <SettingsSection>
          <SettingsRow
            label='Clear all memories'
            detail='Remove every saved fact on this device'
            icon='reload'
            destructive
            showChevron
            isLast
            onPress={handleClearAll}
          />
        </SettingsSection>
      ) : null}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  kindText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  memoryMeta: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  memoryTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  memoryDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  memoryWhen: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
