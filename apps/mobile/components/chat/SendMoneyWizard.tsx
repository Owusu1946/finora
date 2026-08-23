import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  PaymentConfirmationCard,
  type PaymentConfirmation,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { AmountFundingStep } from '@/components/chat/send/AmountFundingStep';
import { CountryStep } from '@/components/chat/send/CountryStep';
import {
  DestinationFieldsStep,
  type DestinationFields,
} from '@/components/chat/send/DestinationFieldsStep';
import { FxQuoteStep } from '@/components/chat/send/FxQuoteStep';
import { PurposeCodeStep } from '@/components/chat/send/PurposeCodeStep';
import { RailStep } from '@/components/chat/send/RailStep';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  CRYPTO_CORRIDOR,
  PURPOSE_CODE_LABELS,
  SETTLEMENT_METHOD_LABELS,
  fieldsForRail,
  getCorridor,
  previewFxQuote,
  railsForCountry,
  type PurposeCode,
  type SettlementMethod,
} from '@/lib/send-corridors';

export type SendMoneySeed = {
  amount?: number;
  /** Payout / destination currency */
  currency?: string;
  fundingCurrency?: string;
  recipientName?: string;
  destinationCountry?: string;
  settlementMethod?: SettlementMethod;
  purposeCode?: PurposeCode;
  reference?: string;
  destinationKind?: PaymentConfirmation['destination']['kind'];
  destinationLabel?: string;
  destinationValue?: string;
  network?: string;
  iban?: string;
  swiftBic?: string;
  sortCode?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountCategory?: 'CHECKING' | 'SAVINGS';
  accountName?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  blockchain?: string;
};

type Step = 'country' | 'rail' | 'destination' | 'amount' | 'purpose' | 'fx' | 'confirm';

function kindFromMethod(method: SettlementMethod): PaymentConfirmation['destination']['kind'] {
  if (method === 'MOMO') return 'mobile_money';
  if (method === 'CRYPTO') return 'crypto_wallet';
  return 'bank_account';
}

function destinationSummary(
  method: SettlementMethod,
  fields: DestinationFields,
): { label: string; value: string } {
  const label = SETTLEMENT_METHOD_LABELS[method];
  if (method === 'MOMO') {
    return { label: `${fields.network ?? 'MoMo'} MoMo`, value: fields.phone ?? '—' };
  }
  if (method === 'CRYPTO') {
    return {
      label: `${fields.blockchain ?? 'Crypto'}`,
      value: fields.cryptoAddress ?? '—',
    };
  }
  if (method === 'SEPA' || method === 'SWIFT') {
    return { label, value: fields.iban || fields.accountNumber || '—' };
  }
  if (method === 'FPS' || method === 'CHAPS') {
    return {
      label,
      value: fields.sortCode
        ? `${fields.sortCode} · ${fields.accountNumber ?? ''}`
        : (fields.accountNumber ?? '—'),
    };
  }
  if (method === 'ACH' || method === 'WIRE') {
    return {
      label,
      value: fields.routingNumber
        ? `${fields.routingNumber} · ${fields.accountNumber ?? ''}`
        : (fields.accountNumber ?? '—'),
    };
  }
  return {
    label,
    value: fields.accountNumber || fields.phone || '—',
  };
}

function seedHasDestination(seed: SendMoneySeed): boolean {
  if (seed.destinationValue) return true;
  if (seed.iban || seed.accountNumber || seed.routingNumber) return true;
  return false;
}

function fieldsFromSeed(seed: SendMoneySeed): DestinationFields {
  return {
    recipientName: seed.recipientName,
    network: seed.network,
    phone: seed.settlementMethod === 'MOMO' ? seed.destinationValue : undefined,
    accountNumber:
      seed.accountNumber ??
      (seed.settlementMethod !== 'MOMO' && seed.settlementMethod !== 'CRYPTO'
        ? seed.destinationValue
        : undefined),
    bankCode: undefined,
    accountName: seed.accountName ?? seed.recipientName,
    iban: seed.iban,
    swiftBic: seed.swiftBic,
    sortCode: seed.sortCode,
    routingNumber: seed.routingNumber,
    accountCategory: seed.accountCategory,
    cryptoAddress: seed.settlementMethod === 'CRYPTO' ? seed.destinationValue : undefined,
    blockchain: seed.blockchain,
    addressLine1: seed.addressLine1,
    city: seed.city,
    postalCode: seed.postalCode,
  };
}

function initialStep(seed: SendMoneySeed): Step {
  if (!seed.destinationCountry && seed.settlementMethod !== 'CRYPTO') return 'country';
  if (!seed.settlementMethod) return 'rail';
  if (!seedHasDestination(seed) || !seed.recipientName) return 'destination';
  if (seed.amount == null) return 'amount';
  if (!seed.purposeCode) return 'purpose';
  const funding = seed.fundingCurrency ?? seed.currency ?? 'USD';
  const payout = seed.currency ?? getCorridor(seed.destinationCountry ?? '')?.currency ?? 'USD';
  if (funding !== payout) return 'fx';
  return 'confirm';
}

export function SendMoneyWizard({
  seed,
  status = 'pending',
  loading,
  sendingStep,
  transactionId,
  contactSaved,
  contactSaving,
  onConfirm,
  onCancel,
  onSaveContact,
  onViewDetails,
  onEdit,
}: {
  seed: SendMoneySeed;
  status?: PaymentConfirmationStatus;
  loading?: boolean;
  sendingStep?: number;
  transactionId?: string;
  contactSaved?: boolean;
  contactSaving?: boolean;
  onConfirm?: (payment: PaymentConfirmation) => void;
  onCancel?: () => void;
  onSaveContact?: () => void;
  onViewDetails?: () => void;
  /** Called when user wants to leave confirm and edit (optional) */
  onEdit?: () => void;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(() => initialStep(seed));
  const [countryQuery, setCountryQuery] = useState('');
  const [country, setCountry] = useState<string | null>(
    seed.settlementMethod === 'CRYPTO' ? 'CRYPTO' : (seed.destinationCountry ?? null),
  );
  const [method, setMethod] = useState<SettlementMethod | null>(seed.settlementMethod ?? null);
  const [fields, setFields] = useState<DestinationFields>(() => fieldsFromSeed(seed));
  const [amount, setAmount] = useState<number | null>(seed.amount ?? null);
  const [customAmount, setCustomAmount] = useState('');
  const [fundingCurrency, setFundingCurrency] = useState(
    seed.fundingCurrency ?? seed.currency ?? 'USD',
  );
  const [purposeCode, setPurposeCode] = useState<PurposeCode | null>(seed.purposeCode ?? null);

  const corridor = country && country !== 'CRYPTO' ? getCorridor(country) : undefined;
  const payoutCurrency =
    method === 'CRYPTO'
      ? seed.currency && (CRYPTO_CORRIDOR.currencies as string[]).includes(seed.currency)
        ? seed.currency
        : 'USDT'
      : (corridor?.currency ?? seed.currency ?? 'USD');

  const rails: SettlementMethod[] =
    country === 'CRYPTO' ? CRYPTO_CORRIDOR.rails : country ? railsForCountry(country) : [];

  const requiredFields =
    method && country ? fieldsForRail(country === 'CRYPTO' ? 'GH' : country, method) : [];

  const needsFx = amount != null && fundingCurrency.toUpperCase() !== payoutCurrency.toUpperCase();

  const fxQuote = useMemo(() => {
    if (!needsFx || amount == null) return null;
    return previewFxQuote({
      from: fundingCurrency,
      to: payoutCurrency,
      amount,
    });
  }, [amount, fundingCurrency, needsFx, payoutCurrency]);

  const activeSteps = useMemo(() => {
    const base: Step[] = ['country', 'rail', 'destination', 'amount', 'purpose'];
    if (needsFx) base.push('fx');
    base.push('confirm');
    return base;
  }, [needsFx]);

  const stepIndex = Math.max(1, activeSteps.indexOf(step) + 1);
  const stepTotal = activeSteps.length;

  const payment: PaymentConfirmation | null = useMemo(() => {
    if (!method || amount == null || !purposeCode) return null;
    const name = (fields.recipientName ?? seed.recipientName ?? 'Recipient').trim();
    if (!name) return null;
    const summary = destinationSummary(method, fields);
    return {
      amount,
      currency: payoutCurrency,
      recipientName: name,
      destination: {
        kind: kindFromMethod(method),
        label: summary.label,
        value: summary.value,
      },
      reference: seed.reference,
      destinationCountry: country === 'CRYPTO' ? undefined : (country ?? undefined),
      countryName: corridor?.name,
      settlementMethod: method,
      settlementMethodLabel: SETTLEMENT_METHOD_LABELS[method],
      purposeCode,
      purposeLabel: PURPOSE_CODE_LABELS[purposeCode],
      fundingCurrency,
      fx: fxQuote ?? undefined,
      accountName: fields.accountName,
      iban: fields.iban,
      swiftBic: fields.swiftBic,
      deliveryHint:
        method === 'MOMO'
          ? 'Typically instant'
          : method === 'FPS' || method === 'SEPA'
            ? 'Usually same day'
            : method === 'SWIFT' || method === 'WIRE'
              ? '1–3 business days'
              : method === 'CRYPTO'
                ? 'Network confirmation'
                : 'Same or next business day',
    };
  }, [
    amount,
    corridor?.name,
    country,
    fields,
    fundingCurrency,
    fxQuote,
    method,
    payoutCurrency,
    purposeCode,
    seed.recipientName,
    seed.reference,
  ]);

  const goNextFrom = (current: Step) => {
    haptics.selection();
    const idx = activeSteps.indexOf(current);
    const next = activeSteps[idx + 1];
    if (next) setStep(next);
  };

  const goBackFrom = (current: Step) => {
    haptics.selection();
    const idx = activeSteps.indexOf(current);
    const prev = activeSteps[idx - 1];
    if (prev) setStep(prev);
  };

  if (status !== 'pending' && payment) {
    return (
      <PaymentConfirmationCard
        payment={payment}
        status={status}
        loading={loading}
        sendingStep={sendingStep}
        transactionId={transactionId}
        contactSaved={contactSaved}
        contactSaving={contactSaving}
        onConfirm={undefined}
        onCancel={undefined}
        onSaveContact={onSaveContact}
        onViewDetails={onViewDetails}
      />
    );
  }

  if (step === 'confirm' && payment) {
    return (
      <View className='gap-2'>
        <PaymentConfirmationCard
          payment={payment}
          status='pending'
          loading={loading}
          onConfirm={() => onConfirm?.(payment)}
          onCancel={onCancel}
        />
        <Pressable
          onPress={() => {
            haptics.selection();
            onEdit?.();
            setStep(needsFx ? 'fx' : 'purpose');
          }}
          className='py-1 px-1'
        >
          <Text className='text-[14px] font-medium text-muted-foreground'>← Edit details</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className='my-2 border p-3.5 gap-3 max-w-[420px] self-stretch bg-composer border-border'
      style={[styles.card]}
    >
      {step === 'country' ? (
        <CountryStep
          step={stepIndex}
          total={stepTotal}
          country={country}
          query={countryQuery}
          onQueryChange={setCountryQuery}
          includeCrypto
          onSelectCrypto={() => {
            setCountry('CRYPTO');
            setMethod('CRYPTO');
            setFundingCurrency((f) => f || 'USDT');
            goNextFrom('country');
            // skip rail when crypto selected with method
            setStep('destination');
          }}
          onSelect={(code) => {
            setCountry(code);
            const c = getCorridor(code);
            if (c) {
              setFundingCurrency((f) => f || c.currency);
              if (method && !c.rails.includes(method)) setMethod(null);
            }
            setStep('rail');
          }}
        />
      ) : null}

      {step === 'rail' ? (
        <RailStep
          step={stepIndex}
          total={stepTotal}
          rails={rails}
          selected={method}
          countryName={corridor?.name}
          onSelect={(rail) => {
            setMethod(rail);
            goNextFrom('rail');
          }}
        />
      ) : null}

      {step === 'destination' && method ? (
        <DestinationFieldsStep
          step={stepIndex}
          total={stepTotal}
          method={method}
          fields={method === 'CRYPTO' ? CRYPTO_CORRIDOR.fields : requiredFields}
          values={fields}
          onChange={setFields}
          onBack={() => goBackFrom('destination')}
          onContinue={() => goNextFrom('destination')}
        />
      ) : null}

      {step === 'amount' ? (
        <AmountFundingStep
          step={stepIndex}
          total={stepTotal}
          amount={amount}
          customAmount={customAmount}
          payoutCurrency={payoutCurrency}
          fundingCurrency={fundingCurrency}
          onAmount={setAmount}
          onCustomAmount={setCustomAmount}
          onFundingCurrency={setFundingCurrency}
          onBack={() => goBackFrom('amount')}
          onContinue={() => goNextFrom('amount')}
        />
      ) : null}

      {step === 'purpose' ? (
        <PurposeCodeStep
          step={stepIndex}
          total={stepTotal}
          purposeCode={purposeCode}
          onSelect={setPurposeCode}
          onBack={() => goBackFrom('purpose')}
          onContinue={() => {
            if (needsFx) setStep('fx');
            else setStep('confirm');
          }}
        />
      ) : null}

      {step === 'fx' && fxQuote && amount != null ? (
        <FxQuoteStep
          step={stepIndex}
          total={stepTotal}
          amount={amount}
          quote={fxQuote}
          onBack={() => goBackFrom('fx')}
          onContinue={() => setStep('confirm')}
        />
      ) : null}

      {step === 'rail' || step === 'country' ? (
        <View className='flex-row gap-2.5'>
          {step === 'rail' ? (
            <Pressable
              onPress={() => goBackFrom('rail')}
              className='flex-1 min-h-[46px] border items-center justify-center'
              style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text className='text-[16px] font-semibold text-foreground'>Back</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onCancel}
              className='flex-1 min-h-[46px] border items-center justify-center'
              style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text className='text-[16px] font-semibold text-foreground'>Cancel</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.lg,
  },
  navBtn: {
    borderRadius: Radius.composer,
  },
};
