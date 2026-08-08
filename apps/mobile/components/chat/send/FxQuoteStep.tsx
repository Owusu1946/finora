import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardStepHeader } from '@/components/chat/WizardChrome';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FxQuoteView = {
  from: string;
  to: string;
  rate: number;
  fee: number;
  convertedAmount: number;
};

export function FxQuoteStep({
  step,
  total,
  amount,
  quote,
  onBack,
  onContinue,
}: {
  step: number;
  total: number;
  amount: number;
  quote: FxQuoteView;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='FX quote'
        subtitle='Indicative rate · finalised at settlement'
      />
      <View
        style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Row
          label='You send'
          value={formatPaymentAmount(amount, quote.from)}
          colors={colors}
        />
        <Row
          label='Fee'
          value={formatPaymentAmount(quote.fee, quote.from)}
          colors={colors}
        />
        <Row
          label='Rate'
          value={`1 ${quote.from} = ${quote.rate} ${quote.to}`}
          colors={colors}
        />
        <Row
          label='Recipient gets'
          value={formatPaymentAmount(quote.convertedAmount, quote.to)}
          colors={colors}
          emphasize
        />
      </View>
      <View style={styles.nav}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.navBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.navLabel, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            styles.navBtnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.navLabelPrimary, { color: colors.background }]}>Review payment</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
  emphasize,
}: {
  label: string;
  value: string;
  colors: { mutedForeground: string; foreground: string };
  emphasize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          {
            color: colors.foreground,
            fontWeight: emphasize ? '700' : '600',
            fontFamily: 'DMSans_400Regular',
            fontSize: emphasize ? 17 : 14,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowValue: { fontSize: 15, letterSpacing: -0.2 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  navBtn: {
    flex: 1,
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 16, fontWeight: '600' },
  navLabelPrimary: { fontSize: 16, fontWeight: '600' },
});
