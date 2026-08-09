import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FinancialReport = {
  title: string;
  period: string;
  inflow: number;
  outflow: number;
  net: number;
  currency: string;
  highlights: string[];
};

type Result = { report?: FinancialReport };

export const FinancialReportToolUI = makeAssistantToolUI<{ period?: string }, Result>({
  toolName: 'generate_financial_insights',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const report = result?.report;

    if (status.type === 'running' && !report) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Generating financial report…
          </Text>
        </View>
      );
    }

    if (!report) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No report available.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{report.title}</Text>
        <Text style={[styles.period, { color: colors.mutedForeground }]}>{report.period}</Text>
        <View style={styles.metrics}>
          <Metric
            label='In'
            value={formatPaymentAmount(report.inflow, report.currency)}
            colors={colors}
          />
          <Metric
            label='Out'
            value={formatPaymentAmount(report.outflow, report.currency)}
            colors={colors}
          />
          <Metric
            label='Net'
            value={formatPaymentAmount(report.net, report.currency)}
            colors={colors}
          />
        </View>
        {report.highlights.map((h) => (
          <Text
            key={h}
            style={[styles.muted, { color: colors.mutedForeground }]}
          >
            · {h}
          </Text>
        ))}
      </View>
    );
  },
});

function Metric({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

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
  period: { fontFamily: 'DMSans_400Regular', fontSize: 14, fontWeight: '500' },
  metrics: { flexDirection: 'row', gap: 12, marginVertical: 6 },
  metric: { flex: 1, gap: 2 },
  metricValue: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '700' },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
