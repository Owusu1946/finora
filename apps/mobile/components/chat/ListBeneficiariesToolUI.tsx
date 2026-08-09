import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Beneficiary } from '@/lib/beneficiaries-storage';

type Result = { beneficiaries?: Beneficiary[] };

export const ListBeneficiariesToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_beneficiaries',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const beneficiaries = result?.beneficiaries;

    if (status.type === 'running' && !beneficiaries) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Loading beneficiaries…
          </Text>
        </View>
      );
    }

    if (!beneficiaries?.length) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No payout beneficiaries saved yet.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {beneficiaries.length} beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'}
        </Text>
        {beneficiaries.map((b) => (
          <View
            key={b.id}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.foreground }]}>{b.name}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                {b.rail ?? b.method} · {b.identifier}
                {b.verified ? ' · Verified' : ''}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.mutedForeground }]}>{b.currency}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 14, fontWeight: '600' },
});
