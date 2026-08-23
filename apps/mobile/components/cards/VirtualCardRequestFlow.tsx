import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { VirtualCardCurrency } from '@/components/cards/types';

import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput } from '@/components/ui/text';
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
      className='rounded-full border px-3.5 py-2.5 active:opacity-70'
      style={{
        backgroundColor: selected ? colors.foreground : colors.muted,
        borderColor: selected ? colors.foreground : colors.border,
        borderCurve: 'continuous',
      }}
    >
      <Text
        className='font-sans-medium text-sm'
        style={{ color: selected ? colors.background : colors.foreground }}
      >
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
    <View className='min-h-[210px] justify-between overflow-hidden rounded-[25px] bg-[#24283d] p-[22px] shadow-xl'>
      <View className='flex-row items-center justify-between'>
        <Text className='font-sans-semibold text-[15px] tracking-[1.5px] text-[#f8f8fb]'>
          FINORA
        </Text>
        <Text className='font-sans-semibold text-[11px] tracking-[1px] text-[#aeb4ce]'>
          VIRTUAL
        </Text>
      </View>
      <View className='mt-3 h-[27px] w-9 rounded-[7px] bg-[#d0b67c]' />
      <Text className='mt-3 font-sans-medium text-lg tracking-[1.6px] text-[#f8f8fb]'>
        •••• •••• •••• 4821
      </Text>
      <View className='mt-5 flex-row justify-between'>
        <View>
          <Text className='font-sans-medium text-[9px] tracking-[1px] text-[#aeb4ce]'>PURPOSE</Text>
          <Text className='mt-1 font-sans-medium text-[13px] text-[#f8f8fb]'>{purpose}</Text>
        </View>
        <View className='items-end'>
          <Text className='font-sans-medium text-[9px] tracking-[1px] text-[#aeb4ce]'>
            MONTHLY LIMIT
          </Text>
          <Text className='mt-1 font-sans-medium text-[13px] text-[#f8f8fb]'>
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
        contentContainerClassName='gap-[22px] px-5 pb-11 pt-[18px]'
      >
        <View className='items-center gap-4 pt-[34px]'>
          <View className='h-[52px] w-[52px] items-center justify-center rounded-full bg-foreground'>
            <Icon
              name='check'
              size={24}
              color={colors.background}
            />
          </View>
          <Text className='font-sans-semibold text-[29px] leading-[34px] text-foreground'>
            Your request is in
          </Text>
          <Text className='font-sans text-base leading-[22px] text-muted-foreground'>
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
            className='mt-0.5 min-h-[54px] flex-row items-center justify-center gap-[9px] rounded-full bg-foreground px-[18px] active:opacity-75'
          >
            <Text className='font-sans-semibold text-base text-background'>Back to wallets</Text>
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
      contentContainerClassName='gap-[22px] px-5 pb-11 pt-[18px]'
    >
      <View className='gap-[7px]'>
        <Text className='font-sans-semibold text-xs tracking-[1.1px] text-muted-foreground'>
          VIRTUAL CARD
        </Text>
        <Text className='font-sans-semibold text-[29px] leading-[34px] text-foreground'>
          A card for the way you spend
        </Text>
        <Text className='font-sans text-base leading-[22px] text-muted-foreground'>
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
          className='gap-3.5 rounded-2xl border border-border bg-muted p-[18px]'
          style={{ borderCurve: 'continuous' }}
        >
          <Text className='mb-0.5 font-sans-semibold text-lg text-foreground'>
            Review your request
          </Text>
          <View className='flex-row items-center justify-between'>
            <Text className='font-sans text-[15px] text-muted-foreground'>Purpose</Text>
            <Text className='font-sans-semibold text-[15px] text-foreground'>{purpose}</Text>
          </View>
          <View className='flex-row items-center justify-between'>
            <Text className='font-sans text-[15px] text-muted-foreground'>Currency</Text>
            <Text className='font-sans-semibold text-[15px] text-foreground'>{currency}</Text>
          </View>
          <View className='flex-row items-center justify-between'>
            <Text className='font-sans text-[15px] text-muted-foreground'>Monthly limit</Text>
            <Text className='font-sans-semibold text-[15px] text-foreground'>
              {currency} {limit}
            </Text>
          </View>
          <View className='flex-row items-start gap-2 border-t border-border pt-3.5'>
            <Icon
              name='shield'
              size={16}
              color={colors.mutedForeground}
            />
            <Text className='flex-1 font-sans text-[13px] leading-[18px] text-muted-foreground'>
              You’ll confirm with your passcode before the card is created.
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View className='gap-2.5'>
            <Text className='font-sans-semibold text-base text-foreground'>What’s it for?</Text>
            <View className='flex-row flex-wrap gap-2'>
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
          <View className='gap-2.5'>
            <Text className='font-sans-semibold text-base text-foreground'>Card currency</Text>
            <View className='flex-row flex-wrap gap-2'>
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
          <View className='gap-2.5'>
            <Text className='font-sans-semibold text-base text-foreground'>
              Monthly spending limit
            </Text>
            <View
              className='min-h-[54px] flex-row items-center rounded-xl border border-border bg-muted px-3.5'
              style={{ borderCurve: 'continuous' }}
            >
              <Text className='mr-[9px] font-sans-semibold text-base text-muted-foreground'>
                {currency}
              </Text>
              <AppTextInput
                value={limit}
                onChangeText={(value) => setLimit(value.replace(/[^0-9]/g, ''))}
                keyboardType='number-pad'
                className='flex-1 py-0 font-sans-semibold text-[19px] text-foreground'
              />
            </View>
          </View>
        </>
      )}

      <Pressable
        disabled={busy || (!isReview && !canReview)}
        onPress={() => (isReview ? void submit() : setStep('review'))}
        className='mt-0.5 min-h-[54px] flex-row items-center justify-center gap-[9px] rounded-full bg-foreground px-[18px] active:opacity-75 disabled:opacity-40'
      >
        <Text className='font-sans-semibold text-base text-background'>
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
          className='items-center py-0.5'
        >
          <Text className='font-sans-medium text-sm text-muted-foreground'>Edit details</Text>
        </Pressable>
      ) : null}
      {modal}
    </ScrollView>
  );
}
