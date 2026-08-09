import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { accounts?: ReceiveMethod[] };

export const ListVirtualAccountsToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_virtual_accounts',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const accounts = result?.accounts;

    if (status.type === 'running' && !accounts) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Loading virtual accounts…
          </Text>
        </View>
      );
    }

    if (!accounts?.length) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No virtual accounts yet. Fund via bank transfer to issue one.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {accounts.length} virtual account{accounts.length === 1 ? '' : 's'}
        </Text>
        {accounts.map((account) => (
          <View
            key={account.id}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.foreground }]}>{account.title}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                {account.fields
                  .slice(0, 2)
                  .map((f) => `${f.label}: ${f.value}`)
                  .join(' · ')}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.mutedForeground }]}>
              {account.currency}
            </Text>
          </View>
        ))}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  box: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  card: {
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 14, fontWeight: '600' },
});
