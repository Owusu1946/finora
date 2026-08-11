import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MomoNetworkId } from '@/lib/momo-networks';

import { FinoraMarkLoader } from '@/components/ui/finora-mark-loader';
import { Icon } from '@/components/ui/icon';
import { SuccessCheckmark } from '@/components/ui/success-checkmark';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { playPaymentSuccessSound } from '@/lib/sounds';

import type { DepositPalette, DepositStep } from './types';

import { MomoIcon } from './icons';
import { PrimaryButton } from './primitives';
import { depositStyles as styles } from './styles';

export function MomoFlowScreen({
  step,
  colors,
  momoNetwork,
  momoNetworkLabel,
  phone,
  amount,
  amountNum,
  momoFee,
  onStepChange,
  onPhoneChange,
  onAmountChange,
  onPickContact,
  onDone,
}: {
  step: Extract<DepositStep, 'momo' | 'momo_awaiting' | 'momo_completed'>;
  colors: DepositPalette;
  momoNetwork: MomoNetworkId;
  momoNetworkLabel: string;
  phone: string;
  amount: string;
  amountNum: number;
  momoFee: number;
  onStepChange: (step: DepositStep) => void;
  onPhoneChange: (phone: string) => void;
  onAmountChange: (amount: string) => void;
  onPickContact: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.sheetFullScreen,
        {
          backgroundColor: colors.card,
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.sheetHeader}>
        {step === 'momo' ? (
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onStepChange('methods');
            }}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Icon
              name='chevron-left'
              size={22}
              color={colors.foreground}
            />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text
          style={[
            styles.sheetTitle,
            { color: colors.foreground, flex: 1, textAlign: 'center', marginRight: 30 },
          ]}
        >
          {step === 'momo_completed' ? 'Funds added' : 'Mobile money'}
        </Text>
      </View>

      {step === 'momo' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.momoScroll}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <MomoForm
            colors={colors}
            momoNetwork={momoNetwork}
            momoNetworkLabel={momoNetworkLabel}
            phone={phone}
            amount={amount}
            amountNum={amountNum}
            momoFee={momoFee}
            onOpenNetworkPicker={() => {
              haptics.selection();
              Keyboard.dismiss();
              onStepChange('momo_network_picker');
            }}
            onPhoneChange={onPhoneChange}
            onAmountChange={onAmountChange}
            onPickContact={onPickContact}
            onContinue={() => {
              haptics.success();
              Keyboard.dismiss();
              onStepChange('momo_awaiting');
            }}
          />
        </ScrollView>
      ) : null}

      {step === 'momo_awaiting' ? (
        <MomoAwaitingStep
          colors={colors}
          amountNum={amountNum}
          onCompleted={() => {
            onStepChange('momo_completed');
          }}
        />
      ) : null}

      {step === 'momo_completed' ? (
        <MomoCompletedStep
          colors={colors}
          momoNetworkLabel={momoNetworkLabel}
          amountNum={amountNum}
          onDone={onDone}
        />
      ) : null}
    </View>
  );
}

function MomoForm({
  colors,
  momoNetwork,
  momoNetworkLabel,
  phone,
  amount,
  amountNum,
  momoFee,
  onOpenNetworkPicker,
  onPhoneChange,
  onAmountChange,
  onPickContact,
  onContinue,
}: {
  colors: DepositPalette;
  momoNetwork: MomoNetworkId;
  momoNetworkLabel: string;
  phone: string;
  amount: string;
  amountNum: number;
  momoFee: number;
  onOpenNetworkPicker: () => void;
  onPhoneChange: (phone: string) => void;
  onAmountChange: (amount: string) => void;
  onPickContact: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Network</Text>
      <Pressable
        onPress={onOpenNetworkPicker}
        style={[styles.selectField, { backgroundColor: colors.muted }]}
      >
        <View style={styles.selectLeft}>
          <MomoIcon
            id={momoNetwork}
            size={28}
          />
          <Text style={[styles.selectValue, { color: colors.foreground }]}>{momoNetworkLabel}</Text>
        </View>
        <Icon
          name='chevron-down'
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Phone number</Text>
      <View style={[styles.selectField, { backgroundColor: colors.muted }]}>
        <TextInput
          value={phone}
          onChangeText={onPhoneChange}
          keyboardType='phone-pad'
          placeholder='0XX XXX XXXX'
          placeholderTextColor={colors.mutedForeground}
          style={[styles.inputFlex, { color: colors.foreground }]}
        />
        <Pressable
          onPress={() => void onPickContact()}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel='Pick from contacts'
        >
          <Icon
            name='contacts'
            size={20}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount (GHS)</Text>
      <View style={[styles.selectField, { backgroundColor: colors.muted }]}>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          keyboardType='decimal-pad'
          placeholder='0.00'
          placeholderTextColor={colors.mutedForeground}
          style={[styles.inputFlex, { color: colors.foreground }]}
        />
      </View>

      {amountNum > 0 ? (
        <View style={[styles.feeAlert, { backgroundColor: colors.muted }]}>
          <Icon
            name='info'
            size={15}
            color={colors.mutedForeground}
          />
          <Text style={[styles.feeAlertText, { color: colors.mutedForeground }]}>
            MoMo fee 0.8% · ₵{momoFee.toFixed(2)} (you'll approve ₵
            {(amountNum + momoFee).toFixed(2)} on your phone)
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        label='Continue'
        colors={colors}
        disabled={phone.trim().length < 9 || !(amountNum > 0)}
        onPress={onContinue}
      />
    </>
  );
}

const MOMO_PROMPT_SECONDS = 90;

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MomoAwaitingStep({
  colors,
  amountNum,
  onCompleted,
}: {
  colors: DepositPalette;
  amountNum: number;
  onCompleted: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(MOMO_PROMPT_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.momoStatusBody}>
      <View style={styles.awaitingHero}>
        <Text style={[styles.awaitingTitle, { color: colors.foreground }]}>Awaiting approval</Text>
        <FinoraMarkLoader size={88} />
        <Text style={[styles.awaitingAmount, { color: colors.foreground }]}>
          ₵{amountNum.toFixed(2)}
        </Text>
      </View>

      <Text style={[styles.awaitingExpiry, { color: colors.mutedForeground }]}>
        {secondsLeft > 0 ? `Expires in ${formatCountdown(secondsLeft)}` : 'Prompt expired'}
      </Text>

      <PrimaryButton
        label='Completed'
        colors={colors}
        onPress={onCompleted}
      />
    </View>
  );
}

function MomoCompletedStep({
  colors,
  momoNetworkLabel,
  amountNum,
  onDone,
}: {
  colors: DepositPalette;
  momoNetworkLabel: string;
  amountNum: number;
  onDone: () => void;
}) {
  useEffect(() => {
    haptics.success();
    void playPaymentSuccessSound();
  }, []);

  return (
    <View style={styles.momoStatusBody}>
      <View style={styles.successHero}>
        <SuccessCheckmark size={80} />
        <Animated.View entering={FadeInDown.delay(280).duration(320)}>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Deposit received</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(380).duration(320)}>
          <Text style={[styles.successAmount, { color: colors.foreground }]}>
            ₵{amountNum.toFixed(2)}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(460).duration(320)}>
          <Text style={[styles.awaitingMeta, { color: colors.mutedForeground }]}>
            Added to your GHS wallet via {momoNetworkLabel}
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(520).duration(280)}>
        <PrimaryButton
          label='Done'
          colors={colors}
          onPress={onDone}
        />
      </Animated.View>
    </View>
  );
}
