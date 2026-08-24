import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { getTreasuryOverview, type TreasuryOverview } from '@/lib/treasury';

export default function TreasuryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getTreasuryOverview().then(setOverview);
    }, []),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Treasury</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Treasury is available on Business accounts. Switch in Settings.
        </Text>
      </View>
    );
  }

  if (!overview) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LoadingIcon
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
      <Text style={[styles.title, { color: colors.foreground }]}>Treasury</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Cash position and upcoming business outflows. Settlement still goes through approval.
      </Text>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Total (USD eq.)</Text>
        <Text style={[styles.big, { color: colors.foreground }]}>
          {formatPaymentAmount(overview.totalUsd, 'USD')}
        </Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.push('/');
            aui.composer.setText('Show treasury overview');
            aui.composer.send();
          }}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnLabel, { color: colors.background }]}>Ask in chat</Text>
        </Pressable>
      </View>

      {overview.balances.map((b) => (
        <View
          key={b.currency}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.name, { color: colors.foreground }]}>{b.currency}</Text>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(b.balance, b.currency)}
          </Text>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Upcoming</Text>
      {overview.upcomingOutflows.slice(0, 6).map((item, i) => (
        <View
          key={`${item.label}-${i}`}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text
            style={[styles.name, { color: colors.foreground, flex: 1 }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(item.amount, item.currency)}
          </Text>
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
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
  },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '600' },
  big: { fontFamily: 'DMSans_400Regular', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  btn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  section: { marginTop: 8, fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '600' },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
});
