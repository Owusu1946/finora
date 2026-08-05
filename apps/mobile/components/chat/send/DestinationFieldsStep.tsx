import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CorridorFieldKey, SettlementMethod } from '@/lib/send-corridors';
import { SETTLEMENT_METHOD_LABELS } from '@/lib/send-corridors';

export type DestinationFields = {
  network?: string;
  phone?: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  iban?: string;
  swiftBic?: string;
  sortCode?: string;
  routingNumber?: string;
  accountCategory?: 'CHECKING' | 'SAVINGS';
  cryptoAddress?: string;
  blockchain?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  recipientName?: string;
};

const FIELD_META: Record<
  CorridorFieldKey,
  { label: string; placeholder: string; autoCap?: 'characters' | 'words' | 'none' }
> = {
  network: { label: 'Network', placeholder: 'MTN' },
  phone: { label: 'Phone number', placeholder: '0550123456', autoCap: 'none' },
  accountNumber: { label: 'Account number', placeholder: '0123456789', autoCap: 'none' },
  bankCode: { label: 'Bank code', placeholder: 'GCB', autoCap: 'characters' },
  accountName: { label: 'Account name', placeholder: 'As on the bank account', autoCap: 'words' },
  iban: { label: 'IBAN', placeholder: 'DE89…', autoCap: 'characters' },
  swiftBic: { label: 'SWIFT / BIC', placeholder: 'DEUTDEFF', autoCap: 'characters' },
  sortCode: { label: 'Sort code', placeholder: '04-00-04', autoCap: 'none' },
  routingNumber: { label: 'Routing number', placeholder: '021000021', autoCap: 'none' },
  accountCategory: { label: 'Account type', placeholder: 'CHECKING' },
  cryptoAddress: { label: 'Wallet address', placeholder: '0x… / T…', autoCap: 'none' },
  blockchain: { label: 'Network', placeholder: 'TRON' },
  addressLine1: { label: 'Address', placeholder: 'Street address', autoCap: 'words' },
  city: { label: 'City', placeholder: 'City', autoCap: 'words' },
  postalCode: { label: 'Postal code', placeholder: '10001', autoCap: 'characters' },
};

const MOMO_NETWORKS = ['MTN', 'VODAFONE', 'TELECEL', 'AIRTEL', 'MPESA'];
const CHAINS = ['TRON', 'ETHEREUM', 'POLYGON', 'SOLANA', 'BASE'];

export function DestinationFieldsStep({
  step,
  total,
  method,
  fields,
  values,
  onChange,
  onBack,
  onContinue,
}: {
  step: number;
  total: number;
  method: SettlementMethod;
  fields: CorridorFieldKey[];
  values: DestinationFields;
  onChange: (next: DestinationFields) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();

  const set = (key: keyof DestinationFields, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const complete = fields.every((key) => {
    if (key === 'accountCategory') return Boolean(values.accountCategory);
    if (key === 'network') return Boolean(values.network);
    if (key === 'blockchain') return Boolean(values.blockchain);
    const v = values[key as keyof DestinationFields];
    return typeof v === 'string' && v.trim().length > 0;
  });

  return (
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='Recipient details'
        subtitle={`${SETTLEMENT_METHOD_LABELS[method]} · enter settlement fields`}
      />

      <TextInput
        value={values.recipientName ?? ''}
        onChangeText={(t) => set('recipientName', t)}
        placeholder='Recipient name'
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize='words'
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      />

      {fields.map((key) => {
        if (key === 'network') {
          return (
            <View key={key} style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Network</Text>
              <View style={styles.chips}>
                {MOMO_NETWORKS.map((n) => (
                  <WizardChip
                    key={n}
                    label={n}
                    selected={values.network === n}
                    onPress={() => set('network', n)}
                  />
                ))}
              </View>
            </View>
          );
        }
        if (key === 'blockchain') {
          return (
            <View key={key} style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Chain</Text>
              <View style={styles.chips}>
                {CHAINS.map((n) => (
                  <WizardChip
                    key={n}
                    label={n}
                    selected={values.blockchain === n}
                    onPress={() => set('blockchain', n)}
                  />
                ))}
              </View>
            </View>
          );
        }
        if (key === 'accountCategory') {
          return (
            <View key={key} style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Account type</Text>
              <View style={styles.chips}>
                {(['CHECKING', 'SAVINGS'] as const).map((n) => (
                  <WizardChip
                    key={n}
                    label={n === 'CHECKING' ? 'Checking' : 'Savings'}
                    selected={values.accountCategory === n}
                    onPress={() => onChange({ ...values, accountCategory: n })}
                  />
                ))}
              </View>
            </View>
          );
        }

        const meta = FIELD_META[key];
        const value = (values[key as keyof DestinationFields] as string | undefined) ?? '';
        return (
          <View key={key} style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{meta.label}</Text>
            <TextInput
              value={value}
              onChangeText={(t) => set(key as keyof DestinationFields, t)}
              placeholder={meta.placeholder}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize={meta.autoCap === 'none' ? 'none' : meta.autoCap ?? 'sentences'}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
          </View>
        );
      })}

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
          disabled={!complete || !(values.recipientName ?? '').trim()}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.navBtnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity:
                !complete || !(values.recipientName ?? '').trim()
                  ? 0.4
                  : pressed
                    ? 0.85
                    : 1,
            },
          ]}
        >
          <Text style={[styles.navLabelPrimary, { color: colors.background }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  fieldBlock: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
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
  navLabel: { fontSize: 15, fontWeight: '600' },
  navLabelPrimary: { fontSize: 15, fontWeight: '600' },
});
