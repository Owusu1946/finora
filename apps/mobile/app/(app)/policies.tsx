import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listPolicies, setPolicyEnabled, type ApprovalPolicy } from '@/lib/policies-storage';

export default function PoliciesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [policies, setPolicies] = useState<ApprovalPolicy[] | null>(null);

  const refresh = useCallback(async () => {
    setPolicies(await listPolicies());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Approval policies</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Policies are available on Business accounts.
        </Text>
      </View>
    );
  }

  if (!policies) {
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
      <Text style={[styles.title, { color: colors.foreground }]}>Approval policies</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Rules that decide when prepares need your passcode. AI never bypasses these.
      </Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          router.push('/');
          aui.composer.setText('What happens if I send 2000 USD to a new recipient?');
          aui.composer.send();
        }}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.btnLabel, { color: colors.background }]}>Simulate in chat</Text>
      </Pressable>
      {policies.map((p) => (
        <View
          key={p.id}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.foreground }]}>{p.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{p.rule}</Text>
          </View>
          <Switch
            value={p.enabled}
            onValueChange={async (enabled) => {
              haptics.selection();
              await setPolicyEnabled(p.id, enabled);
              await refresh();
            }}
          />
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
  btnLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
