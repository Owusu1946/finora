import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { haptics } from '@/lib/haptics';
import { PASSCODE_LENGTH } from '@/lib/passcode-storage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'back'] as const;

type PasscodeViewProps = {
  mode: 'create' | 'enter';
  title?: string;
  subtitle?: string;
  onSuccess: (passcode: string) => void | Promise<void>;
  onVerify?: (passcode: string) => Promise<boolean> | boolean;
  onBack?: () => void;
  showBack?: boolean;
};

export function PasscodeView({
  mode,
  title: customTitle,
  subtitle: customSubtitle,
  onSuccess,
  onVerify,
  onBack,
  showBack = false,
}: PasscodeViewProps) {
  const { colors } = useTheme();
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

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
        },
      ]}
    >
      <View style={styles.topBar}>
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

      <View style={styles.content}>
        <View style={styles.prompt}>
          <View style={styles.hero}>
            <View style={[styles.shield, { backgroundColor: colors.muted }]}>
              <Icon
                name='shield'
                size={24}
                color={colors.foreground}
              />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {copy.subtitle}
            </Text>
          </View>

          <Animated.View style={[styles.dots, shakeStyle]}>
            {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => {
              const filled = i < value.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      borderColor: error ? colors.destructive : colors.border,
                      backgroundColor: filled
                        ? error
                          ? colors.destructive
                          : colors.foreground
                        : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : (
            <View style={styles.errorSpacer} />
          )}
        </View>

        <View style={[styles.pad, { width: keypadWidth, opacity: loading ? 0.5 : 1 }]}>
          {KEYS.map((key) => {
            if (key === 'empty') {
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
                  style={({ pressed }) => [
                    styles.key,
                    { width: keySize, height: keySize },
                    pressed && { opacity: 0.55 },
                  ]}
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
                style={({ pressed }) => [
                  styles.key,
                  styles.keyDigit,
                  {
                    width: keySize,
                    height: keySize,
                    backgroundColor: pressed ? colors.muted : colors.composer,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.keyLabel, { color: colors.foreground }]}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
  },
  prompt: {
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  shield: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 20,
  },
  errorSpacer: {
    height: 20,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  keyDigit: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
});
