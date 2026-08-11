import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { TreasuryOverview } from '@/lib/treasury';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { overview?: TreasuryOverview };

export const TreasuryOverviewToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'get_treasury_overview',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const overview = result?.overview;

    if (status.type === 'running' && !overview) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Building treasury overview…
          </Text>
        </View>
      );
    }

    if (!overview) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Couldn’t load treasury.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Treasury</Text>
        <Text style={[styles.total, { color: colors.foreground }]}>
          {formatPaymentAmount(overview.totalUsd, 'USD')}
        </Text>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          Total across wallets (USD equivalent)
        </Text>

        <View style={styles.section}>
          {overview.balances.map((b) => (
            <View
              key={b.currency}
              style={styles.row}
            >
              <Text style={[styles.name, { color: colors.foreground }]}>{b.currency}</Text>
              <Text style={[styles.amount, { color: colors.foreground }]}>
                {formatPaymentAmount(b.balance, b.currency)}
              </Text>
            </View>
          ))}
        </View>

        {overview.upcomingOutflows.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              Upcoming outflows
            </Text>
            {overview.upcomingOutflows.slice(0, 5).map((item, i) => (
              <View
                key={`${item.label}-${i}`}
                style={styles.row}
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
          </View>
        ) : null}

        {overview.notes.map((note) => (
          <Text
            key={note}
            style={[styles.muted, { color: colors.mutedForeground }]}
          >
            {note}
          </Text>
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
    gap: 8,
  },
  eyebrow: { fontFamily: 'DMSans_400Regular', fontSize: 12, fontWeight: '600' },
  total: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  section: { marginTop: 6, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 14, fontWeight: '600' },
});
