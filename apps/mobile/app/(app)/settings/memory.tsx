import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  clearMemories,
  forgetMemory,
  getMemories,
  setMemoriesEnabled,
  type FinoraMemory,
} from '@/lib/memory-api';

function memoryKindLabel(kind: FinoraMemory['kind']): string {
  return kind === 'preference'
    ? 'Preference'
    : kind === 'contact'
      ? 'Contact'
      : kind === 'supplier'
        ? 'Supplier'
        : 'Note';
}

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
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<{ enabled: boolean; items: FinoraMemory[] }>({
    enabled: true,
    items: [],
  });

  const refresh = useCallback(async () => {
    try {
      const next = await getMemories(getToken);
      setStore({ enabled: next.enabled, items: next.memories });
    } catch {
      Alert.alert('Could not load memory', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleToggle = async (enabled: boolean) => {
    const previous = store.enabled;
    setStore((current) => ({ ...current, enabled }));
    try {
      const next = await setMemoriesEnabled(getToken, enabled);
      setStore((current) => ({ ...current, enabled: next }));
      haptics.selection();
      return true;
    } catch {
      setStore((current) => ({ ...current, enabled: previous }));
      Alert.alert('Could not update memory', 'Check your connection and try again.');
      return false;
    }
  };

  const handleForget = (item: FinoraMemory) => {
    Alert.alert('Forget memory', `Remove “${item.title}” from Finora’s memory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          try {
            await forgetMemory(getToken, item.id);
            setStore((current) => ({
              ...current,
              items: current.items.filter((memory) => memory.id !== item.id),
            }));
            haptics.success();
          } catch {
            Alert.alert('Could not forget memory', 'Check your connection and try again.');
          }
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
            try {
              await clearMemories(getToken);
              setStore((current) => ({ ...current, items: [] }));
              haptics.success();
            } catch {
              Alert.alert('Could not clear memory', 'Check your connection and try again.');
            }
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
          <View className='items-center gap-2 px-6 py-7'>
            <Icon
              name='brain'
              size={22}
              color={colors.mutedForeground}
            />
            <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
              No memories
            </Text>
            <Text className='text-center font-sans-medium text-sm leading-[18px] text-muted-foreground'>
              Ask Finora to remember a preference, or keep chatting — useful details show up here.
            </Text>
          </View>
        ) : (
          store.items.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => handleForget(item)}
              className={
                index < store.items.length - 1
                  ? 'flex-row items-start gap-3 border-b border-border px-3.5 py-3.5'
                  : 'flex-row items-start gap-3 px-3.5 py-3.5'
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className='mt-0.5 rounded-[14px] bg-muted px-2 py-1'>
                <Text className='font-sans text-xs font-bold uppercase tracking-[0.2px] text-muted-foreground'>
                  {memoryKindLabel(item.kind)}
                </Text>
              </View>
              <View className='min-w-0 flex-1 gap-[3px]'>
                <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
                  {item.title}
                </Text>
                <Text
                  className='font-sans-medium text-sm leading-[18px] text-muted-foreground'
                  numberOfLines={2}
                >
                  {item.content}
                </Text>
                <Text className='mt-0.5 font-sans-medium text-[13px] text-muted-foreground'>
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
