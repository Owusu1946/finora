import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
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

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'back'] as const;

type PasscodeViewProps = {
  mode: 'create' | 'enter';
  title?: string;
  subtitle?: string;
  onSuccess: (passcode: string) => void | Promise<void>;
  onVerify?: (passcode: string) => Promise<boolean> | boolean;
  /** Called after device biometrics succeed. Resolve false to show a PIN error. */
  onBiometricUnlock?: () => Promise<boolean> | boolean;
  onBack?: () => void;
  showBack?: boolean;
};

export function PasscodeView({
  mode,
  title: customTitle,
  subtitle: customSubtitle,
  onSuccess,
  onVerify,
  onBiometricUnlock,
  onBack,
  showBack = false,
}: PasscodeViewProps) {
  const { colors } = useTheme();
  const { authenticate, isAvailable: biometricAvailable, method } = useBiometricUnlock();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const [step, setStep] = useState<'create_first' | 'create_confirm' | 'enter'>(
    mode === 'create' ? 'create_first' : 'enter',
  );
  const [firstPasscode, setFirstPasscode] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shakeX = useSharedValue(0);
  const submittingRef = useRef(false);

  const keySize = Math.min(
    72,
    Math.max(
      62,
      Math.floor(Math.min((width - 96) / 3, (height - insets.top - insets.bottom - 330) / 4)),
    ),
  );
  const keypadWidth = keySize * 3 + 36;

  const triggerFailure = useCallback(
    (msg: string) => {
      setError(msg);
      setValue('');
      submittingRef.current = false;
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
    },
    [shakeX],
  );

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const copy = useMemo(() => {
    if (customTitle && customSubtitle) return { title: customTitle, subtitle: customSubtitle };
    if (step === 'create_first') {
      return {
        title: 'Create a passcode',
        subtitle: 'Choose a 6-digit PIN to secure your account and approve transactions.',
      };
    }
    if (step === 'create_confirm') {
      return {
        title: 'Confirm your passcode',
        subtitle: 'Re-enter your 6-digit PIN to confirm.',
      };
    }
    return {
      title: 'Enter your passcode',
      subtitle: 'Enter your 6-digit PIN to continue to Finora.',
    };
  }, [customSubtitle, customTitle, step]);

  const handleDigit = async (digit: string) => {
    if (loading || submittingRef.current || value.length >= PASSCODE_LENGTH) return;
    if (error) setError(null);
    haptics.selection();
    const nextValue = value + digit;
    setValue(nextValue);

    if (nextValue.length === PASSCODE_LENGTH) {
      submittingRef.current = true;

      if (step === 'create_first') {
        setTimeout(() => {
          setFirstPasscode(nextValue);
          setValue('');
          setStep('create_confirm');
          setError(null);
          submittingRef.current = false;
        }, 150);
        return;
      }

      if (step === 'create_confirm') {
        if (nextValue !== firstPasscode) {
          setTimeout(() => {
            triggerFailure('Passcodes did not match. Start over.');
            setStep('create_first');
            setFirstPasscode('');
          }, 150);
          return;
        }

        setLoading(true);
        try {
          await onSuccess(nextValue);
        } catch {
          triggerFailure('Could not save passcode. Try again.');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (step === 'enter') {
        setLoading(true);
        try {
          const ok = onVerify ? await onVerify(nextValue) : true;
          if (ok) {
            await onSuccess(nextValue);
          } else {
            triggerFailure('Incorrect passcode. Try again.');
          }
        } catch {
          triggerFailure('Verification failed. Try again.');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const backspace = () => {
    if (loading || !value) return;
    if (error) setError(null);
    haptics.selection();
    setValue((v) => v.slice(0, -1));
  };

  const handleBiometricUnlock = async () => {
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      const result = await authenticate(
        step === 'enter' ? 'Unlock Finora' : 'Confirm your identity',
      );
      if (result === 'success') {
        const ok = onBiometricUnlock ? await onBiometricUnlock() : true;
        if (!onBiometricUnlock || ok) {
          await onSuccess('');
          return;
        }
        triggerFailure('Could not verify your account. Enter your passcode.');
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <View
      className='flex-1 bg-background px-6'
      style={{ paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 }}
    >
      <View className='h-9 items-start justify-center'>
        {showBack && onBack ? (
          <Pressable
            accessibilityLabel='Back'
            hitSlop={12}
            onPress={() => {
              haptics.selection();
              onBack();
            }}
          >
            <View style={{ transform: [{ rotate: '-90deg' }] }}>
              <Icon
                name='arrow-up'
                size={22}
                color={colors.foreground}
              />
            </View>
          </Pressable>
        ) : null}
      </View>

      <View className='flex-1 items-center justify-center gap-6 py-3'>
        <View className='items-center'>
          <View className='mb-6 items-center gap-2.5'>
            <View className='mb-1 h-14 w-14 items-center justify-center rounded-full bg-muted'>
              <Icon
                name='shield'
                size={24}
                color={colors.foreground}
              />
            </View>
            <Text className='text-center font-sans-semibold text-[27px] text-foreground'>
              {copy.title}
            </Text>
            <Text className='max-w-[300px] text-center font-sans-medium text-base leading-[22px] text-muted-foreground'>
              {copy.subtitle}
            </Text>
          </View>

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
                    borderColor: error ? colors.destructive : colors.border,
                    backgroundColor: filled
                      ? error
                        ? colors.destructive
                        : colors.foreground
                      : 'transparent',
                  }}
                />
              );
            })}
          </Animated.View>

          {error ? (
            <Text
              className='min-h-5 text-center font-sans-medium text-sm'
              style={{ color: colors.destructive }}
            >
              {error}
            </Text>
          ) : (
            <View className='h-5' />
          )}
        </View>

        <View
          className='flex-row flex-wrap justify-between gap-y-3'
          style={{ width: keypadWidth, opacity: loading ? 0.5 : 1 }}
        >
          {KEYS.map((key) => {
            if (key === 'empty') {
              if (mode === 'enter' && biometricAvailable) {
                return (
                  <Pressable
                    key='biometric'
                    accessibilityLabel={
                      method === 'face' ? 'Unlock with Face ID' : 'Unlock with fingerprint'
                    }
                    disabled={loading}
                    onPress={() => void handleBiometricUnlock()}
                    className='items-center justify-center rounded-full active:opacity-[0.55]'
                    style={{ width: keySize, height: keySize }}
                  >
                    <Icon
                      name={method === 'face' ? 'face-id' : 'biometric'}
                      size={28}
                      color={colors.foreground}
                    />
                  </Pressable>
                );
              }
              return (
                <View
                  key='empty'
                  style={{ width: keySize, height: keySize }}
                />
              );
            }
            if (key === 'back') {
              return (
                <Pressable
                  key='back'
                  accessibilityLabel='Delete digit'
                  disabled={loading}
                  onPress={backspace}
                  className='items-center justify-center rounded-full active:opacity-[0.55]'
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
                disabled={loading}
                onPress={() => void handleDigit(key)}
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
      </View>
    </View>
  );
}
