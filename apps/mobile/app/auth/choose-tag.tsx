import { useAuth, useUser } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/lib/auth-gate';
import { clearPendingAuthProfile, getPendingAuthProfile } from '@/lib/auth-profile';
import { setTagConfigured } from '@/lib/auth-storage';
import { cx } from '@/lib/cx';
import {
  checkFinoraTagAvailability,
  registerCurrentUserFinoraTag,
  suggestFinoraTagFromName,
} from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { hasPasscode } from '@/lib/passcode-storage';
import { ProfileApiError, updateUserProfile } from '@/lib/profile-api';
import { saveSettings } from '@/lib/settings-storage';

function availabilityMessage(result: ReturnType<typeof checkFinoraTagAvailability>) {
  if (result.ok) return { text: `@${result.tag} is available`, tone: 'ok' as const };
  if (result.reason === 'too_short') {
    return { text: 'At least 3 characters', tone: 'muted' as const };
  }
  if (result.reason === 'taken') {
    return { text: 'That tag is taken — try another', tone: 'error' as const };
  }
  return {
    text: 'Start with a letter; use letters, numbers, and underscores only',
    tone: 'error' as const,
  };
}

export default function ChooseTagScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { markTagConfigured } = useAuthGate();
  const { user } = useUser();
  const { getToken } = useAuth();

  const pending = getPendingAuthProfile();
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const profile = getPendingAuthProfile();
    const clerkEmail =
      user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';
    const clerkName = user?.fullName?.trim() || user?.firstName?.trim() || '';
    const suggested = suggestFinoraTagFromName(
      profile?.name ?? clerkName,
      profile?.email ?? clerkEmail,
    );
    if (suggested) setTagInput(suggested);
  }, [user]);

  const availability = useMemo(() => checkFinoraTagAvailability(tagInput), [tagInput]);
  const hint = availabilityMessage(availability);
  const canSubmit = availability.ok && !loading && Boolean(user?.id);

  const handleContinue = async () => {
    if (!canSubmit || !availability.ok) return;
    if (!user?.id) {
      haptics.impact();
      setSubmitError('Your authenticated profile is still loading. Try again.');
      return;
    }
    setSubmitError(null);
    setLoading(true);

    const recheck = checkFinoraTagAvailability(tagInput);
    if (!recheck.ok) {
      setLoading(false);
      haptics.impact();
      setSubmitError('That tag is no longer available.');
      return;
    }

    const profile = getPendingAuthProfile();
    const email =
      profile?.email ??
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      '';
    const displayName =
      profile?.name?.trim() || user?.fullName?.trim() || user?.firstName?.trim() || recheck.tag;

    try {
      const onboarding = await getOnboardingState();
      if (!onboarding.accountType) throw new Error('Your account type is missing.');

      await updateUserProfile(getToken, {
        accountType: onboarding.accountType,
        finoraTag: recheck.tag,
      });
      await Promise.all([
        saveSettings({
          finoraTag: recheck.tag,
          displayName,
          ...(email ? { email } : {}),
        }),
        setTagConfigured(user.id),
      ]);
      registerCurrentUserFinoraTag({
        tag: recheck.tag,
        displayName,
        email,
      });
      clearPendingAuthProfile();
      haptics.success();
      const hasPin = await hasPasscode();
      if (!hasPin) {
        router.replace('/auth/create-passcode' as Href);
      } else {
        markTagConfigured();
        router.replace('/(app)' as Href);
      }
    } catch (error) {
      haptics.impact();
      if (error instanceof ProfileApiError) {
        setSubmitError(
          error.code === 'tag_taken'
            ? 'That tag was just taken — try another.'
            : error.code === 'timeout'
              ? 'The local API timed out. Make sure the API and LAN proxy are running.'
              : error.code === 'network'
                ? 'Could not reach the local API. Make sure this phone and computer share a network.'
                : error.message,
        );
      } else {
        setSubmitError('Could not finish profile setup. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <AuthButton
          label='Continue'
          onPress={handleContinue}
          loading={loading}
          disabled={!canSubmit}
        />
      }
    >
      <View className='mb-1 gap-2.5'>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Choose your Finora tag
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
          {pending?.name ? `${pending.name}, pick` : 'Pick'} a unique @name so others can send you
          money instantly.
        </Text>
      </View>

      <View className='gap-2'>
        <Text className='font-sans-medium text-sm tracking-[-0.1px] text-muted-foreground'>
          Finora tag
        </Text>
        <View
          className={cx(
            'min-h-[54px] flex-row items-center gap-1 rounded-full border bg-composer px-4 py-[15px]',
            submitError || hint.tone === 'error' ? 'border-destructive' : 'border-border',
          )}
        >
          <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
            @
          </Text>
          <TextInput
            value={tagInput}
            onChangeText={(text) => {
              setSubmitError(null);
              setTagInput(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
            }}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='username'
            textContentType='username'
            placeholder='yourname'
            placeholderTextColor={colors.mutedForeground}
            className='flex-1 font-sans py-0 text-[17px] tracking-[-0.2px] text-foreground'
          />
          {availability.ok ? (
            <Icon
              name='check'
              size={18}
              color={colors.foreground}
            />
          ) : null}
        </View>

        <Text
          className={cx(
            'font-sans-medium text-[13px] leading-[18px]',
            hint.tone === 'error'
              ? 'text-destructive'
              : hint.tone === 'ok'
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {submitError ?? hint.text}
        </Text>
      </View>
    </AuthShell>
  );
}
