import { useAui } from '@assistant-ui/react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listSuppliers, type Supplier } from '@/lib/suppliers-storage';

export default function SuppliersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);

  const refresh = useCallback(async () => {
    setSuppliers(await listSuppliers());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Suppliers</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Suppliers are available on Business accounts. Switch account type in Settings.
        </Text>
      </View>
    );
  }

  if (!suppliers) {
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
    <LegendList
      data={suppliers}
      keyExtractor={(supplier) => supplier.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Suppliers</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Saved vendor beneficiaries. Pay from chat — each payout still needs your passcode.
          </Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/');
              aui.composer.setText('Show suppliers');
              aui.composer.send();
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.foreground,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
          </Pressable>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      renderItem={({ item: supplier }) => (
        <View
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.foreground }]}>{supplier.name}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {supplier.destination.label} · {supplier.destination.value}
              </Text>
              {supplier.notes ? (
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {supplier.notes}
                </Text>
              ) : null}
            </View>
            {supplier.defaultAmount != null ? (
              <Text style={[styles.amount, { color: colors.foreground }]}>
                {formatPaymentAmount(supplier.defaultAmount, supplier.currency)}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              haptics.selection();
              const amount = supplier.defaultAmount ?? 500;
              router.push('/');
              aui.composer.setText(`Pay ${supplier.name} ${amount} ${supplier.currency}`);
              aui.composer.send();
            }}
            style={({ pressed }) => [
              styles.btnGhost,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Pay in chat</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    gap: 10,
    paddingBottom: 10,
  },
  itemSeparator: {
    height: 10,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
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
  },
  btnGhost: {
    minHeight: 42,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
