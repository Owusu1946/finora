import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { listAutomations, setAutomationStatus, type Automation } from '@/lib/automations-storage';
import { haptics } from '@/lib/haptics';

export default function AutomationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [items, setItems] = useState<Automation[] | null>(null);

  const refresh = useCallback(async () => {
    setItems(await listAutomations());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Automations</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Automations are available on Business accounts.
        </Text>
      </View>
    );
  }

  if (!items) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior='automatic'
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Automations</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Rules can prepare actions only — money still needs your approval.
      </Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          router.push('/');
          aui.composer.setText('Show my automations');
          aui.composer.send();
        }}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
      </Pressable>
      {items.map((a) => (
        <View
          key={a.id}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.name, { color: colors.foreground }]}>{a.name}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            When {a.trigger} → {a.action}
          </Text>
          <Pressable
            onPress={async () => {
              haptics.selection();
              await setAutomationStatus(a.id, a.status === 'active' ? 'paused' : 'active');
              await refresh();
            }}
            style={({ pressed }) => [
              styles.btnGhost,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>
              {a.status === 'active' ? 'Pause' : 'Resume'}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 10 },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 25, fontWeight: '600', letterSpacing: -0.4 },
  sub: {
    marginTop: -4,
    marginBottom: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  btn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  btnGhost: {
    minHeight: 42,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  btnLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    gap: 6,
  },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
