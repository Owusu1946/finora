import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { listBeneficiaries, type Beneficiary } from '@/lib/beneficiaries-storage';
import { haptics } from '@/lib/haptics';

export default function BeneficiariesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [items, setItems] = useState<Beneficiary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listBeneficiaries().then(setItems);
    }, []),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Beneficiaries</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Payout beneficiaries are available on Business accounts.
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
      <Text style={[styles.title, { color: colors.foreground }]}>Beneficiaries</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Saved WeWire-style payout destinations. Contacts stay as your personal address book.
      </Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          router.push('/');
          aui.composer.setText('Show beneficiaries');
          aui.composer.send();
        }}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
      </Pressable>
      {items.map((b) => (
        <View
          key={b.id}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.foreground }]}>{b.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {b.rail ?? b.method} · {b.identifier}
              {b.verified ? ' · Verified' : ''}
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>{b.currency}</Text>
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
    gap: 10,
  },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500' },
});
