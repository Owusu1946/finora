import { normalizeGhanaPhoneNumber } from '@finora/shared';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AUTH_OTP_LENGTH, AuthOtpInput } from '@/components/auth/AuthOtpInput';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { usePhoneGate } from '@/lib/phone-gate';
import { PhoneVerificationError, usePhoneVerification } from '@/lib/use-phone-verification';

const RESEND_SECONDS = 30;
function getSafeReturnTo(value: string | string[] | undefined) {
  const candidate = typeof value === 'string' ? value : undefined;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.startsWith('/auth') || candidate.startsWith('/onboarding')) return null;
  return candidate;
}

export default function AddPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeReturnTo(params.returnTo);
  const { colors } = useTheme();
  const { tagConfigured } = useAuthGate();
  const { status: phoneStatus, markVerified } = usePhoneGate();
  const phoneVerification = usePhoneVerification();

  const submittingRef = useRef(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const finish = useCallback(() => {
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    router.replace((tagConfigured ? '/(app)' : '/auth/choose-tag') as Href);
  }, [returnTo, router, tagConfigured]);

  useEffect(() => {
    if (phoneStatus !== 'verified') return;
    finish();
  }, [finish, phoneStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timeout = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timeout);
  }, [cooldown]);

  const parsedPhone = useMemo(() => normalizeGhanaPhoneNumber(phoneInput), [phoneInput]);

  const sendCode = useCallback(async () => {
    if (submittingRef.current || loading || !parsedPhone) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await phoneVerification.request(parsedPhone, { force: true });
      if (result?.verified) {
        markVerified();
        haptics.success();
        finish();
        return;
      }
      setNormalizedPhone(parsedPhone);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setStep('code');
      haptics.success();
    } catch (caught) {
      if (caught instanceof PhoneVerificationError && caught.code === 'phone_number_in_use') {
        haptics.error();
      } else {
        haptics.impact();
      }
      setError(
        caught instanceof PhoneVerificationError
          ? caught.message
          : 'Could not send a verification code. Check the number and try again.',
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [finish, loading, markVerified, parsedPhone, phoneVerification]);

  const verifyCode = useCallback(async () => {
    if (submittingRef.current || loading || code.length !== AUTH_OTP_LENGTH) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await phoneVerification.verify(code);
      markVerified();
      haptics.success();
      finish();
    } catch (caught) {
      if (caught instanceof PhoneVerificationError && caught.code === 'phone_number_in_use') {
        haptics.error();
      } else {
        haptics.impact();
      }
      setError(
        caught instanceof PhoneVerificationError
          ? caught.message
          : 'That code is invalid or expired.',
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [code, finish, loading, markVerified, phoneVerification]);

  const resendCode = useCallback(async () => {
    if (!normalizedPhone || resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      await phoneVerification.request(normalizedPhone, { force: true });
      setCode('');
      setCooldown(RESEND_SECONDS);
      haptics.success();
    } catch (caught) {
      if (caught instanceof PhoneVerificationError && caught.code === 'phone_number_in_use') {
        haptics.error();
      } else {
        haptics.impact();
      }
      setError(
        caught instanceof PhoneVerificationError
          ? caught.message
          : 'Could not resend the verification code.',
      );
    } finally {
      setResending(false);
    }
  }, [cooldown, normalizedPhone, phoneVerification, resending]);

  return (
    <AuthShell
      showBack={Boolean(returnTo)}
      footer={
        <View style={styles.footer}>
          <AuthButton
            label={step === 'phone' ? 'Send verification code' : 'Verify phone number'}
            onPress={() => void (step === 'phone' ? sendCode() : verifyCode())}
            loading={loading}
            disabled={
              loading || (step === 'phone' ? !parsedPhone : code.length !== AUTH_OTP_LENGTH)
            }
          />
          {step === 'code' ? (
            <Pressable
              disabled={cooldown > 0 || resending}
              onPress={() => void resendCode()}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.resend, { color: colors.mutedForeground }]}>
                {cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : resending
                    ? 'Sending…'
                    : 'Resend code'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Icon
            name='phone'
            size={23}
            color={colors.foreground}
          />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === 'phone' ? 'Add your phone number' : 'Verify your phone'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {step === 'phone' ? (
            'We’ll use it only for account security and passcode recovery.'
          ) : (
            <>
              Enter the {AUTH_OTP_LENGTH}-digit code sent to{' '}
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>{normalizedPhone}</Text>
            </>
          )}
        </Text>
      </View>

      {step === 'phone' ? (
        <View style={styles.form}>
          <AuthField
            label='Phone number'
            value={phoneInput}
            onChangeText={(value) => {
              setError(null);
              setPhoneInput(value);
            }}
            keyboardType='phone-pad'
            autoComplete='tel'
            textContentType='telephoneNumber'
            placeholder='024 123 4567 or +233…'
            error={error ?? undefined}
          />
          <View
            style={[
              styles.securityNote,
              { backgroundColor: colors.composer, borderColor: colors.border },
            ]}
          >
            <Icon
              name='shield'
              size={18}
              color={colors.mutedForeground}
            />
            <Text style={[styles.securityText, { color: colors.mutedForeground }]}>
              We verify your number before it can be used for secure account recovery.
            </Text>
          </View>
        </View>
      ) : (
        <AuthOtpInput
          value={code}
          onChange={(value) => {
            setError(null);
            setCode(value);
          }}
          error={error ?? undefined}
        />
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    marginBottom: 6,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  form: {
    gap: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  securityText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  footer: {
    gap: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  resend: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
