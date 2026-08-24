import { useClerk, useUser } from '@clerk/expo';
import { normalizeGhanaPhoneNumber } from '@finora/shared';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AUTH_OTP_LENGTH, AuthOtpInput } from '@/components/auth/AuthOtpInput';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
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
  const { signOut } = useClerk();
  const { user } = useUser();
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
  const [errorCode, setErrorCode] = useState<PhoneVerificationError['code'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [leaving, setLeaving] = useState(false);
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

  const showError = useCallback((caught: unknown, fallback: string) => {
    const verificationError = caught instanceof PhoneVerificationError ? caught : null;
    setErrorCode(verificationError?.code ?? 'request_failed');
    setError(verificationError?.message ?? fallback);
    if (verificationError?.code === 'phone_number_in_use') haptics.error();
    else haptics.impact();
  }, []);

  const returnToSignIn = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    setErrorCode(null);
    const email = user?.primaryEmailAddress?.emailAddress;
    try {
      await signOut();
      haptics.selection();
      router.replace({
        pathname: '/auth/login',
        ...(email ? { params: { email } } : {}),
      });
    } catch {
      haptics.impact();
      setError('Could not return to sign in. Try again.');
      setErrorCode('request_failed');
      setLeaving(false);
    }
  }, [leaving, router, signOut, user?.primaryEmailAddress?.emailAddress]);

  const sendCode = useCallback(async () => {
    if (submittingRef.current || loading || !parsedPhone) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorCode(null);
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
      showError(caught, 'Could not send a verification code. Check the number and try again.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [finish, loading, markVerified, parsedPhone, phoneVerification, showError]);

  const verifyCode = useCallback(async () => {
    if (submittingRef.current || loading || code.length !== AUTH_OTP_LENGTH) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      await phoneVerification.verify(code);
      markVerified();
      haptics.success();
      finish();
    } catch (caught) {
      showError(caught, 'That code is invalid or expired.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [code, finish, loading, markVerified, phoneVerification, showError]);

  const resendCode = useCallback(async () => {
    if (!normalizedPhone || resending || cooldown > 0) return;
    setResending(true);
    setError(null);
    setErrorCode(null);
    try {
      await phoneVerification.request(normalizedPhone, { force: true });
      setCode('');
      setCooldown(RESEND_SECONDS);
      haptics.success();
    } catch (caught) {
      showError(caught, 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  }, [cooldown, normalizedPhone, phoneVerification, resending, showError]);

  return (
    <AuthShell
      showBack={Boolean(returnTo)}
      footer={
        <View className='w-full items-stretch gap-4'>
          <AuthButton
            label={step === 'phone' ? 'Send verification code' : 'Verify phone number'}
            onPress={() => void (step === 'phone' ? sendCode() : verifyCode())}
            loading={loading}
            disabled={
              loading || (step === 'phone' ? !parsedPhone : code.length !== AUTH_OTP_LENGTH)
            }
          />
          {step === 'code' ? (
            <View className='gap-1'>
              <Pressable
                disabled={cooldown > 0 || resending}
                onPress={() => void resendCode()}
                className='active:opacity-60'
              >
                <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
                  {cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : resending
                      ? 'Sending…'
                      : 'Resend code'}
                </Text>
              </Pressable>
              <Pressable
                disabled={loading || resending}
                onPress={() => {
                  haptics.selection();
                  setStep('phone');
                  setCode('');
                  setError(null);
                  setErrorCode(null);
                }}
                className='active:opacity-60'
              >
                <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
                  Change number
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!returnTo ? (
            <Pressable
              disabled={loading || resending || leaving}
              onPress={() => void returnToSignIn()}
              className='active:opacity-60'
            >
              <Text className='py-1 text-center font-sans-semibold text-[15px] text-foreground'>
                {leaving
                  ? 'Returning to sign in…'
                  : errorCode === 'phone_number_in_use'
                    ? 'Sign in to the existing account'
                    : 'Back to sign in'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View className='mb-1.5 gap-2.5'>
        <View className='mb-1 h-[52px] w-[52px] items-center justify-center rounded-full bg-muted'>
          <Icon
            name='phone'
            size={23}
            color={colors.foreground}
          />
        </View>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          {step === 'phone' ? 'Add your phone number' : 'Verify your phone'}
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
          {step === 'phone' ? (
            'We’ll use it only for account security and passcode recovery.'
          ) : (
            <>
              Enter the {AUTH_OTP_LENGTH}-digit code sent to{' '}
              <Text className='font-sans-semibold text-foreground'>{normalizedPhone}</Text>
            </>
          )}
        </Text>
      </View>

      {step === 'phone' ? (
        <View className='gap-4'>
          <AuthField
            label='Phone number'
            value={phoneInput}
            onChangeText={(value) => {
              setError(null);
              setErrorCode(null);
              setPhoneInput(value);
            }}
            keyboardType='phone-pad'
            autoComplete='tel'
            textContentType='telephoneNumber'
            placeholder='024 123 4567 or +233…'
            error={error ?? undefined}
          />
          <View className='flex-row items-start gap-2.5 rounded-[22px] border border-border bg-composer p-3.5'>
            <Icon
              name='shield'
              size={18}
              color={colors.mutedForeground}
            />
            <Text className='flex-1 font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
              We verify your number before it can be used for secure account recovery.
            </Text>
          </View>
        </View>
      ) : (
        <AuthOtpInput
          value={code}
          onChange={(value) => {
            setError(null);
            setErrorCode(null);
            setCode(value);
          }}
          error={error ?? undefined}
        />
      )}
    </AuthShell>
  );
}
