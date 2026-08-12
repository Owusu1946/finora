import { useUser } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/lib/auth-gate';
import { clearPendingAuthProfile, getPendingAuthProfile } from '@/lib/auth-profile';
import { setTagConfigured } from '@/lib/auth-storage';
import {
  checkFinoraTagAvailability,
  registerCurrentUserFinoraTag,
  suggestFinoraTagFromName,
} from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
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

    await saveSettings({
      finoraTag: recheck.tag,
      displayName,
      ...(email ? { email } : {}),
    });
    registerCurrentUserFinoraTag({
      tag: recheck.tag,
      displayName,
      email,
    });
    await setTagConfigured(user.id);
    clearPendingAuthProfile();
    markTagConfigured();
    setLoading(false);
    haptics.success();
    router.replace('/(app)' as Href);
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Choose your Finora tag</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {pending?.name ? `${pending.name}, pick` : 'Pick'} a unique @name so others can send you
          money instantly.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Finora tag</Text>
        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.composer,
              borderColor:
                submitError || hint.tone === 'error' ? colors.destructive : colors.border,
            },
          ]}
        >
          <Text style={[styles.prefix, { color: colors.foreground }]}>@</Text>
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
            style={[styles.input, { color: colors.foreground }]}
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
          style={[
            styles.hint,
            {
              color:
                hint.tone === 'error'
                  ? colors.destructive
                  : hint.tone === 'ok'
                    ? colors.foreground
                    : colors.mutedForeground,
            },
          ]}
        >
          {submitError ?? hint.text}
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
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
    gap: 8,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 54,
  },
  prefix: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
