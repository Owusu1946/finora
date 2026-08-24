import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { VirtualCardCurrency } from '@/components/cards/types';

import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput } from '@/components/ui/text';
import { Radius, Rounded } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { createVirtualCard } from '@/lib/virtual-cards-storage';

type Currency = VirtualCardCurrency;
type Purpose = 'Subscriptions' | 'Travel' | 'Online purchases' | 'Team spend';
type Step = 'details' | 'review';

const currencies: Currency[] = ['USD', 'EUR', 'GBP'];
const purposes: Purpose[] = ['Subscriptions', 'Travel', 'Online purchases', 'Team spend'];

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.foreground : colors.muted,
          borderColor: selected ? colors.foreground : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.background : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function VirtualCardPreview({
  currency,
  purpose,
  limit,
}: {
  currency: Currency;
  purpose: Purpose;
  limit: string;
}) {
  return (
    <View style={styles.cardPreview}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardBrand}>FINORA</Text>
        <Text style={styles.cardNetwork}>VIRTUAL</Text>
      </View>
      <View style={styles.cardChip} />
      <Text style={styles.cardNumber}>•••• •••• •••• 4821</Text>
      <View style={styles.cardBottomRow}>
        <View>
          <Text style={styles.cardCaption}>PURPOSE</Text>
          <Text style={styles.cardValue}>{purpose}</Text>
        </View>
        <View style={styles.cardLimit}>
          <Text style={styles.cardCaption}>MONTHLY LIMIT</Text>
          <Text style={styles.cardValue}>
            {currency} {limit || '500'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function VirtualCardRequestFlow() {
  const { colors } = useTheme();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();
  const [step, setStep] = useState<Step | 'submitted'>('details');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [purpose, setPurpose] = useState<Purpose>('Subscriptions');
  const [limit, setLimit] = useState('500');
  const [busy, setBusy] = useState(false);
  const limitValue = Number(limit);
  const canReview = Number.isSafeInteger(limitValue) && limitValue > 0;

  const submit = async () => {
    if (busy) return;
    if (!Number.isSafeInteger(limitValue) || limitValue <= 0) return;
    setBusy(true);
    try {
      const approved = await requestApproval();
      if (!approved) return;
      await createVirtualCard({
        label: purpose,
        spendLimit: limitValue,
        currency,
      });
      haptics.success();
      setStep('submitted');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'submitted') {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior='automatic'
        contentContainerStyle={styles.content}
      >
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.foreground }]}>
            <Icon
              name='check'
              size={24}
              color={colors.background}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Your request is in</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We’re setting up your virtual card for {purpose.toLowerCase()}. You’ll see its details
            in Cards when it’s ready.
          </Text>
          <VirtualCardPreview
            currency={currency}
            purpose={purpose}
            limit={limit}
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              router.back();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.foreground, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              Back to wallets
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const isReview = step === 'review';
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior='automatic'
      contentContainerStyle={styles.content}
    >
      <View style={styles.intro}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>VIRTUAL CARD</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          A card for the way you spend
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create a separate card for online purchases, travel, or recurring expenses.
        </Text>
      </View>

      <VirtualCardPreview
        currency={currency}
        purpose={purpose}
        limit={limit}
      />

      {isReview ? (
        <View
          style={[styles.reviewCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Review your request
          </Text>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>Purpose</Text>
            <Text style={[styles.reviewValue, { color: colors.foreground }]}>{purpose}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>Currency</Text>
            <Text style={[styles.reviewValue, { color: colors.foreground }]}>{currency}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>
              Monthly limit
            </Text>
            <Text style={[styles.reviewValue, { color: colors.foreground }]}>
              {currency} {limit}
            </Text>
          </View>
          <View style={[styles.note, { borderTopColor: colors.border }]}>
            <Icon
              name='shield'
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              You’ll confirm with your passcode before the card is created.
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>What’s it for?</Text>
            <View style={styles.chips}>
              {purposes.map((item) => (
                <OptionChip
                  key={item}
                  label={item}
                  selected={purpose === item}
                  onPress={() => setPurpose(item)}
                />
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Card currency</Text>
            <View style={styles.chips}>
              {currencies.map((item) => (
                <OptionChip
                  key={item}
                  label={item}
                  selected={currency === item}
                  onPress={() => setCurrency(item)}
                />
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Monthly spending limit</Text>
            <View
              style={[
                styles.limitInput,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>
                {currency}
              </Text>
              <AppTextInput
                value={limit}
                onChangeText={(value) => setLimit(value.replace(/[^0-9]/g, ''))}
                keyboardType='number-pad'
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>
        </>
      )}

      <Pressable
        disabled={busy || (!isReview && !canReview)}
        onPress={() => (isReview ? void submit() : setStep('review'))}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: colors.foreground,
            opacity: busy || (!isReview && !canReview) ? 0.4 : pressed ? 0.76 : 1,
          },
        ]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.background }]}>
          {isReview ? (busy ? 'Requesting…' : 'Request virtual card') : 'Review request'}
        </Text>
        <Icon
          name='arrow-up'
          size={17}
          color={colors.background}
        />
      </Pressable>
      {isReview ? (
        <Pressable
          onPress={() => setStep('details')}
          style={styles.secondaryButton}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.mutedForeground }]}>
            Edit details
          </Text>
        </Pressable>
      ) : null}
      {modal}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 44, gap: 22 },
  intro: { gap: 7 },
  eyebrow: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, letterSpacing: 1.1 },
  title: { fontFamily: 'DMSans_600SemiBold', fontSize: 29, letterSpacing: -0.8, lineHeight: 34 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  cardPreview: {
    minHeight: 210,
    borderRadius: 25,
    padding: 22,
    justifyContent: 'space-between',
    backgroundColor: '#24283d',
    overflow: 'hidden',
    boxShadow: '0 10px 24px rgba(28, 32, 57, 0.22)',
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: '#f8f8fb', fontFamily: 'DMSans_700Bold', fontSize: 15, letterSpacing: 1.5 },
  cardNetwork: {
    color: '#aeb4ce',
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
  },
  cardChip: { width: 36, height: 27, borderRadius: 7, backgroundColor: '#d0b67c', marginTop: 12 },
  cardNumber: {
    color: '#f8f8fb',
    fontFamily: 'DMSans_500Medium',
    fontSize: 18,
    letterSpacing: 1.6,
    marginTop: 12,
  },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cardLimit: { alignItems: 'flex-end' },
  cardCaption: { color: '#aeb4ce', fontFamily: 'DMSans_500Medium', fontSize: 9, letterSpacing: 1 },
  cardValue: { color: '#f8f8fb', fontFamily: 'DMSans_500Medium', fontSize: 13, marginTop: 4 },
  fieldGroup: { gap: 10 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, letterSpacing: -0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    ...Rounded,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  limitInput: {
    ...Rounded,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 54,
  },
  currencyPrefix: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, marginRight: 9 },
  input: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 19, paddingVertical: 0 },
  reviewCard: {
    ...Rounded,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 18,
    gap: 14,
  },
  sectionTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, marginBottom: 2 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15 },
  reviewValue: { fontFamily: 'DMSans_600SemiBold', fontSize: 15 },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
  primaryButton: {
    ...Rounded,
    borderRadius: Radius.pill,
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
  },
  primaryButtonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16 },
  secondaryButton: { alignItems: 'center', paddingVertical: 2 },
  secondaryButtonText: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  successWrap: { gap: 16, alignItems: 'center', paddingTop: 34 },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
