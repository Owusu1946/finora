import { Pressable, View } from 'react-native';

import type { CorridorFieldKey, SettlementMethod } from '@/lib/send-corridors';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

/** One line telling the user what this step actually collects. */
const STEP_SUBTITLES: Record<SettlementMethod, string> = {
  MOMO: 'Mobile money · pick the network and phone number for settlement',
  LOCAL_BANK: 'Bank account · provide the receiving account details',
  ACH: 'Bank account · provide the receiving account details',
  WIRE: 'Wire · provide the receiving account details',
  FPS: 'Faster Payments · provide the sort code and account number',
  CHAPS: 'CHAPS · provide the sort code and account number',
  SEPA: 'SEPA · provide the IBAN of the receiving account',
  SWIFT: 'SWIFT · provide the account number and SWIFT/BIC',
  CRYPTO: 'Crypto · paste the receiving wallet address',
};

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
    <View className='gap-3'>
      <WizardStepHeader
        step={step}
        total={total}
        title='Recipient details'
        subtitle={STEP_SUBTITLES[method] ?? 'Check the details before you continue'}
      />

      <TextInput
        value={values.recipientName ?? ''}
        onChangeText={(t) => set('recipientName', t)}
        placeholder='Recipient name'
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize='words'
        className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
        style={[styles.input]}
      />

      {fields.map((key) => {
        if (key === 'network') {
          return (
            <View
              key={key}
              className='gap-2'
            >
              <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
                Network
              </Text>
              <View className='flex-row flex-wrap gap-2'>
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
            <View
              key={key}
              className='gap-2'
            >
              <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
                Chain
              </Text>
              <View className='flex-row flex-wrap gap-2'>
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
            <View
              key={key}
              className='gap-2'
            >
              <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
                Account type
              </Text>
              <View className='flex-row flex-wrap gap-2'>
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
          <View
            key={key}
            className='gap-2'
          >
            <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
              {meta.label}
            </Text>
            <TextInput
              value={value}
              onChangeText={(t) => set(key as keyof DestinationFields, t)}
              placeholder={
                key === 'accountName' && method === 'MOMO'
                  ? 'Name registered on the account'
                  : meta.placeholder
              }
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize={meta.autoCap === 'none' ? 'none' : (meta.autoCap ?? 'sentences')}
              className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
              style={[styles.input]}
            />
          </View>
        );
      })}

      <View className='flex-row gap-2.5 mt-1'>
        <Pressable
          onPress={onBack}
          className='flex-1 min-h-[46px] items-center justify-center rounded-full bg-muted'
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
        >
          <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
            Back
          </Text>
        </Pressable>
        <Pressable
          disabled={!complete || !(values.recipientName ?? '').trim()}
          onPress={onContinue}
          className='flex-[1.4] min-h-[46px] items-center justify-center rounded-full'
          style={({ pressed }) => [
            {
              backgroundColor: colors.primary,
              opacity: !complete || !(values.recipientName ?? '').trim() ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={{ color: colors.primaryForeground }}
            className='font-sans-semibold text-[16px] tracking-[-0.2px]'
          >
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  input: {
    borderRadius: Radius.composer,
  },
};
