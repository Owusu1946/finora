import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  onAddPhone,
  onClearError,
}: PasscodeModalProps) {
  const { colors } = useTheme();
  const { t } = useSettings();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [value, setValue] = useState('');
  const shakeX = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const lastSubmittedRef = useRef<string | null>(null);
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

        <View style={styles.content}>
          <View style={styles.prompt}>
            <View style={styles.hero}>
              <View style={[styles.shield, { backgroundColor: colors.muted }]}>
                <Icon
                  name='shield'
                  size={22}
                  color={colors.foreground}
                />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {copy.subtitle}
              </Text>
            </View>

            {!phoneRequired ? (
              <Animated.View style={[styles.dots, shakeStyle]}>
                {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => {
                  const filled = i < value.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          borderColor: error || locked ? colors.destructive : colors.border,
                          backgroundColor: filled
                            ? error || locked
                              ? colors.destructive
                              : colors.foreground
                            : 'transparent',
                        },
                      ]}
                    />
                  );
                })}
              </Animated.View>
            ) : null}

            {phoneRequired ? (
              <View style={styles.phoneActions}>
                <Pressable
                  accessibilityRole='button'
                  onPress={() => {
                    haptics.selection();
                    onAddPhone?.();
                  }}
                  style={({ pressed }) => [
                    styles.phonePrimary,
                    { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.phonePrimaryText, { color: colors.background }]}>
                    Add phone number
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  onPress={onClose}
                  style={({ pressed }) => [styles.phoneSecondary, { opacity: pressed ? 0.55 : 1 }]}
                >
                  <Text style={[styles.phoneSecondaryText, { color: colors.mutedForeground }]}>
                    Not now
                  </Text>
                </Pressable>
              </View>
            ) : error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            ) : attemptsLeft != null && mode === 'unlock' && attemptsLeft < MAX_ATTEMPTS ? (
              <Text style={[styles.error, { color: colors.mutedForeground }]}>
                {attemptsLeft} {attemptsLeft === 1 ? 'try' : 'tries'} left
              </Text>
            ) : (
              <View style={styles.errorSpacer} />
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
                style={styles.forgotBtn}
              >
                <Text style={[styles.forgotText, { color: colors.foreground }]}>
                  {mode === 'forgot-otp' ? t('action_resend') : t('passcode_forgot_btn')}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.forgotSpacer} />
            )}
          </View>

          {!phoneRequired ? (
            <View style={[styles.pad, { width: keypadWidth, opacity: locked ? 0.45 : 1 }]}>
              {KEYS.map((key) => {
                if (key === 'bio') {
                  if (mode !== 'unlock' || locked) {
                    return (
                      <View
                        key='bio'
                        style={{ width: keySize, height: keySize }}
                      />
                    );
                  }
                  return (
                    <Pressable
                      key='bio'
                      accessibilityLabel='Biometric unlock (coming soon)'
                      accessibilityHint='Biometric authentication is not available yet. Enter your passcode.'
                      onPress={() => {
                        haptics.selection();
                      }}
                      style={({ pressed }) => [
                        styles.key,
                        { width: keySize, height: keySize },
                        pressed && { opacity: 0.55 },
                      ]}
                    >
                      <Icon
                        name='biometric'
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
                    disabled={locked}
                    onPress={() => pushDigit(key)}
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
          ) : null}
        </View>
      </View>
    </Modal>
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
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
  forgotBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  forgotText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    letterSpacing: -0.2,
    textDecorationLine: 'underline',
  },
  forgotSpacer: {
    height: 32,
  },
  phoneActions: {
    width: 280,
    gap: 10,
    marginTop: 8,
  },
  phonePrimary: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  phonePrimaryText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  phoneSecondary: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSecondaryText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    letterSpacing: -0.2,
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
