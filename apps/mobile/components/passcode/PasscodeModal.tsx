import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useBiometricUnlock } from '@/lib/biometrics';
import { haptics } from '@/lib/haptics';
import { PASSCODE_LENGTH } from '@/lib/passcode-storage';
import { useSettings } from '@/lib/settings-context';

export type PasscodeMode = 'setup' | 'confirm-setup' | 'unlock' | 'forgot-otp' | 'phone-required';

type PasscodeModalProps = {
  visible: boolean;
  mode: PasscodeMode;
  title?: string;
  subtitle?: string;
  error?: string | null;
  /** Remaining unlock attempts before lockout. */
  attemptsLeft?: number | null;
  /** Pad locked after too many wrong tries. */
  locked?: boolean;
  /** Shown under the forgot link (e.g. masked email). */
  forgotHint?: string | null;
  /**
   * Bumped on each failed attempt so digits clear + shake even when the
   * error message string is unchanged.
   */
  failureSignal?: number;
  onClose: () => void;
  /** Called when the user finishes entering PASSCODE_LENGTH digits. */
  onComplete: (passcode: string) => void;
  /** Start forgot-passcode recovery (unlock mode). */
  onForgot?: () => void;
  /** Called after device biometrics succeed in unlock mode. */
  onBiometricUnlock?: () => void;
  /** Open verified phone setup when recovery is unavailable. */
  onAddPhone?: () => void;
  /** Clear a stale error when the user starts typing again. */
  onClearError?: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'back'] as const;
const MAX_ATTEMPTS = 3;

export { MAX_ATTEMPTS };

export function PasscodeModal({
  visible,
  mode,
  title,
  subtitle,
  error,
  attemptsLeft,
  locked = false,
  forgotHint,
  failureSignal = 0,
  onClose,
  onComplete,
  onForgot,
  onBiometricUnlock,
  onAddPhone,
  onClearError,
}: PasscodeModalProps) {
  const { colors } = useTheme();
  const { t } = useSettings();
  const { authenticate, isAvailable: biometricAvailable, method } = useBiometricUnlock();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [value, setValue] = useState('');
  const shakeX = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const lastSubmittedRef = useRef<string | null>(null);
  const biometricPromptedRef = useRef(false);
  const keySize = Math.min(
    72,
    Math.max(
      62,
      Math.floor(Math.min((width - 96) / 3, (height - insets.top - insets.bottom - 330) / 4)),
    ),
  );
  const keypadWidth = keySize * 3 + 36;

  useEffect(() => {
    if (!visible) return;
    setValue('');
    lastSubmittedRef.current = null;
    biometricPromptedRef.current = false;
  }, [visible, mode, title, subtitle]);

  useEffect(() => {
    if (!visible || failureSignal < 1) return;
    setValue('');
    lastSubmittedRef.current = null;
    haptics.error();
    shakeX.value = withSequence(
      withTiming(-12, { duration: 36 }),
      withTiming(12, { duration: 36 }),
      withTiming(-10, { duration: 36 }),
      withTiming(10, { duration: 36 }),
      withTiming(-6, { duration: 36 }),
      withTiming(6, { duration: 36 }),
      withTiming(0, { duration: 36 }),
    );
  }, [failureSignal, shakeX, visible]);

  useEffect(() => {
    if (
      !visible ||
      mode !== 'unlock' ||
      !biometricAvailable ||
      locked ||
      biometricPromptedRef.current
    ) {
      return;
    }

    biometricPromptedRef.current = true;
    let active = true;
    void authenticate('Approve with biometrics').then((result) => {
      if (active && result === 'success') onBiometricUnlock?.();
    });

    return () => {
      active = false;
    };
  }, [authenticate, biometricAvailable, locked, mode, onBiometricUnlock, visible]);

  const copy = useMemo(() => {
    if (title && subtitle) return { title, subtitle };
    if (mode === 'setup') {
      return {
        title: t('passcode_create_title'),
        subtitle: t('passcode_create_sub'),
      };
    }
    if (mode === 'confirm-setup') {
      return {
        title: t('passcode_confirm_title'),
        subtitle: t('passcode_confirm_sub'),
      };
    }
    if (mode === 'forgot-otp') {
      return {
        title: t('passcode_forgot_title'),
        subtitle: forgotHint ? `${t('phone_code_sent')} ${forgotHint}.` : t('passcode_forgot_sub'),
      };
    }
    if (mode === 'phone-required') {
      return {
        title: t('passcode_phone_req_title'),
        subtitle: t('passcode_phone_req_sub'),
      };
    }
    return {
      title: t('passcode_enter_title'),
      subtitle: t('passcode_enter_sub'),
    };
  }, [forgotHint, mode, subtitle, t, title]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const pushDigit = (digit: string) => {
    if (locked || value.length >= PASSCODE_LENGTH) return;
    if (error) onClearError?.();
    haptics.selection();
    const nextValue = value + digit;
    setValue(nextValue);
    if (nextValue.length === PASSCODE_LENGTH) {
      if (lastSubmittedRef.current === nextValue) return;
      lastSubmittedRef.current = nextValue;
      setTimeout(() => {
        onCompleteRef.current(nextValue);
      }, 10);
    }
  };

  const backspace = () => {
    if (locked || !value) return;
    if (error) onClearError?.();
    haptics.selection();
    setValue((v) => v.slice(0, -1));
    lastSubmittedRef.current = null;
  };

  const showForgot =
    mode !== 'phone-required' && (mode === 'unlock' || mode === 'forgot-otp' || locked) && onForgot;
  const phoneRequired = mode === 'phone-required';

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View
        className='flex-1 bg-background px-6'
        style={{ paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 }}
      >
        <View className='h-9 items-start justify-center'>
          <Pressable
            accessibilityLabel='Close'
            hitSlop={12}
            onPress={() => {
              haptics.selection();
              onClose();
            }}
          >
            <Icon
              name='remove'
              size={22}
              color={colors.foreground}
            />
          </Pressable>
        </View>

        <View className='flex-1 items-center justify-center gap-6 py-3'>
          <View className='items-center'>
            <View className='mb-6 items-center gap-2.5'>
              <View className='mb-1 h-[52px] w-[52px] items-center justify-center rounded-full bg-muted'>
                <Icon
                  name='shield'
                  size={22}
                  color={colors.foreground}
                />
              </View>
              <Text className='text-center font-sans-semibold text-[25px] text-foreground'>
                {copy.title}
              </Text>
              <Text className='max-w-[300px] text-center font-sans-medium text-base leading-[22px] text-muted-foreground'>
                {copy.subtitle}
              </Text>
            </View>

            {!phoneRequired ? (
              <Animated.View
                className='mb-2.5 flex-row justify-center gap-3.5'
                style={shakeStyle}
              >
                {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => {
                  const filled = i < value.length;
                  return (
                    <View
                      key={i}
                      className='h-3.5 w-3.5 rounded-full border'
                      style={{
                        borderColor: error || locked ? colors.destructive : colors.border,
                        backgroundColor: filled
                          ? error || locked
                            ? colors.destructive
                            : colors.foreground
                          : 'transparent',
                      }}
                    />
                  );
                })}
              </Animated.View>
            ) : null}

            {phoneRequired ? (
              <View className='mt-2 w-[280px] gap-2.5'>
                <Pressable
                  accessibilityRole='button'
                  onPress={() => {
                    haptics.selection();
                    onAddPhone?.();
                  }}
                  className='min-h-[52px] items-center justify-center rounded-[18px] bg-foreground px-[18px] active:opacity-85'
                >
                  <Text className='font-sans-medium text-base text-background'>
                    Add phone number
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  onPress={onClose}
                  className='min-h-[42px] items-center justify-center active:opacity-55'
                >
                  <Text className='font-sans-medium text-[15px] text-muted-foreground'>
                    Not now
                  </Text>
                </Pressable>
              </View>
            ) : error ? (
              <Text className='min-h-5 text-center font-sans-medium text-sm text-destructive'>
                {error}
              </Text>
            ) : attemptsLeft != null && mode === 'unlock' && attemptsLeft < MAX_ATTEMPTS ? (
              <Text className='min-h-5 text-center font-sans-medium text-sm text-muted-foreground'>
                {attemptsLeft} {attemptsLeft === 1 ? 'try' : 'tries'} left
              </Text>
            ) : (
              <View className='h-5' />
            )}

            {showForgot ? (
              <Pressable
                accessibilityRole='button'
                accessibilityLabel='Forgot passcode'
                onPress={() => {
                  if (!onForgot) return;
                  haptics.selection();
                  onForgot();
                }}
                className='mt-2.5 px-2.5 py-1.5'
              >
                <Text className='font-sans-medium text-[15px] text-foreground underline'>
                  {mode === 'forgot-otp' ? t('action_resend') : t('passcode_forgot_btn')}
                </Text>
              </Pressable>
            ) : (
              <View className='h-8' />
            )}
          </View>

          {!phoneRequired ? (
            <View
              className='flex-row flex-wrap justify-between gap-y-3'
              style={{ width: keypadWidth, opacity: locked ? 0.45 : 1 }}
            >
              {KEYS.map((key) => {
                if (key === 'bio') {
                  if (mode !== 'unlock' || locked || !biometricAvailable) {
                    return (
                      <View
                        key='biometric'
                        style={{ width: keySize, height: keySize }}
                      />
                    );
                  }
                  return (
                    <Pressable
                      key='biometric'
                      accessibilityLabel={
                        method === 'face' ? 'Unlock with Face ID' : 'Unlock with fingerprint'
                      }
                      disabled={locked}
                      onPress={() => {
                        haptics.selection();
                        void authenticate('Approve with biometrics').then((result) => {
                          if (result === 'success') onBiometricUnlock?.();
                        });
                      }}
                      className='items-center justify-center rounded-full active:opacity-55'
                      style={{ width: keySize, height: keySize }}
                    >
                      <Icon
                        name={method === 'face' ? 'face-id' : 'biometric'}
                        size={28}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  );
                }
                if (key === 'back') {
                  return (
                    <Pressable
                      key='back'
                      accessibilityLabel='Delete'
                      disabled={locked}
                      onPress={backspace}
                      className='items-center justify-center rounded-full active:opacity-55'
                      style={{ width: keySize, height: keySize }}
                    >
                      <View style={{ transform: [{ rotate: '180deg' }] }}>
                        <Icon
                          name='eraser'
                          size={26}
                          color={colors.foreground}
                        />
                      </View>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={key}
                    accessibilityLabel={`Digit ${key}`}
                    disabled={locked}
                    onPress={() => pushDigit(key)}
                    className='items-center justify-center rounded-full border active:bg-muted'
                    style={{
                      width: keySize,
                      height: keySize,
                      backgroundColor: colors.composer,
                      borderColor: colors.border,
                    }}
                  >
                    <Text className='font-sans-medium text-[29px] text-foreground'>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
