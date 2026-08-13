import { usePathname, useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  MAX_ATTEMPTS,
  PasscodeModal,
  type PasscodeMode,
} from '@/components/passcode/PasscodeModal';
import { haptics } from '@/lib/haptics';
import { clearPasscode, hasPasscode, setPasscode, verifyPasscode } from '@/lib/passcode-storage';
import { PasscodeRecoveryError, usePasscodeRecovery } from '@/lib/use-passcode-recovery';

type ChangePhase =
  | 'closed'
  | 'unlock'
  | 'setup'
  | 'confirm-setup'
  | 'create-setup'
  | 'create-confirm'
  | 'forgot-otp'
  | 'phone-required';

/**
 * Change existing passcode (verify → new → confirm) or create if none exists.
 * Unlock attempts shake on failure; 3 fails require SMS OTP reset.
 */
export function useChangePasscode() {
  const router = useRouter();
  const pathname = usePathname();
  const passcodeRecovery = usePasscodeRecovery();
  const [phase, setPhase] = useState<ChangePhase>('closed');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failureSignal, setFailureSignal] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [locked, setLocked] = useState(false);
  const [forgotHint, setForgotHint] = useState<string | null>(null);
  const draftRef = useRef('');
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const recoveringRef = useRef(false);

  const markFailure = useCallback((message: string) => {
    setError(message);
    setFailureSignal((n) => n + 1);
  }, []);

  const close = useCallback((ok: boolean) => {
    setPhase('closed');
    draftRef.current = '';
    setDraft('');
    setError(null);
    setFailureSignal(0);
    setAttemptsLeft(MAX_ATTEMPTS);
    setLocked(false);
    setForgotHint(null);
    recoveringRef.current = false;
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(ok);
  }, []);

  const requestChange = useCallback(async () => {
    const exists = await hasPasscode();
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setError(null);
      setFailureSignal(0);
      setDraft('');
      setAttemptsLeft(MAX_ATTEMPTS);
      setLocked(false);
      setForgotHint(null);
      recoveringRef.current = false;
      setPhase(exists ? 'unlock' : 'create-setup');
    });
  }, []);

  const startForgot = useCallback(async () => {
    try {
      const result = await passcodeRecovery.request();
      haptics.success();
      recoveringRef.current = true;
      setLocked(false);
      setForgotHint(result.phoneHint);
      setError(null);
      setPhase('forgot-otp');
    } catch (error) {
      haptics.error();
      if (error instanceof PasscodeRecoveryError && error.code === 'verified_phone_required') {
        setError(null);
        setLocked(false);
        setPhase('phone-required');
        return;
      }
      setError(error instanceof Error ? error.message : 'Could not send reset code.');
    }
  }, [passcodeRecovery]);

  const onComplete = useCallback(
    async (code: string) => {
      if (phase === 'unlock') {
        if (locked) return;
        const ok = await verifyPasscode(code);
        if (!ok) {
          const next = attemptsLeft - 1;
          setAttemptsLeft(next);
          if (next <= 0) {
            setLocked(true);
            markFailure('Too many attempts. Reset with the code sent to your phone.');
            void startForgot();
            return;
          }
          markFailure(
            next === 1
              ? 'Incorrect passcode. 1 try left.'
              : `Incorrect passcode. ${next} tries left.`,
          );
          return;
        }
        setError(null);
        setPhase('setup');
        return;
      }

      if (phase === 'forgot-otp') {
        try {
          await passcodeRecovery.verify(code);
        } catch (error) {
          markFailure(error instanceof Error ? error.message : 'That code is incorrect.');
          return;
        }
        await clearPasscode();
        haptics.success();
        setError(null);
        setDraft('');
        setAttemptsLeft(MAX_ATTEMPTS);
        setPhase('setup');
        return;
      }

      if (phase === 'setup' || phase === 'create-setup') {
        draftRef.current = code;
        setDraft(code);
        setError(null);
        setPhase(phase === 'create-setup' ? 'create-confirm' : 'confirm-setup');
        return;
      }

      if (phase === 'confirm-setup' || phase === 'create-confirm') {
        const expected = draftRef.current || draft;
        if (code !== expected) {
          markFailure('Passcodes don’t match. Try again.');
          draftRef.current = '';
          setDraft('');
          setPhase(phase === 'create-confirm' ? 'create-setup' : 'setup');
          return;
        }
        await setPasscode(code);
        haptics.success();
        close(true);
      }
    },
    [attemptsLeft, close, draft, locked, markFailure, passcodeRecovery, phase, startForgot],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup' || phase === 'create-confirm'
      ? 'confirm-setup'
      : phase === 'setup' || phase === 'create-setup'
        ? 'setup'
        : phase === 'forgot-otp'
          ? 'forgot-otp'
          : phase === 'phone-required'
            ? 'phone-required'
            : 'unlock';

  const title =
    phase === 'unlock'
      ? 'Current passcode'
      : phase === 'setup' || phase === 'create-setup'
        ? recoveringRef.current
          ? 'Create new passcode'
          : 'New passcode'
        : phase === 'confirm-setup' || phase === 'create-confirm'
          ? 'Confirm new passcode'
          : undefined;

  const subtitle =
    phase === 'unlock'
      ? 'Enter your current Finora passcode to continue.'
      : phase === 'setup' || phase === 'create-setup'
        ? 'Choose a new passcode for approving money moves.'
        : phase === 'confirm-setup' || phase === 'create-confirm'
          ? 'Enter the same new passcode once more.'
          : undefined;

  const modal = (
    <PasscodeModal
      visible={phase !== 'closed'}
      mode={mode}
      title={title}
      subtitle={subtitle}
      error={error}
      failureSignal={failureSignal}
      attemptsLeft={phase === 'unlock' ? attemptsLeft : null}
      locked={locked && phase === 'unlock'}
      forgotHint={forgotHint}
      onClose={() => close(false)}
      onComplete={onComplete}
      onClearError={() => setError(null)}
      onForgot={
        phase === 'unlock' || phase === 'forgot-otp' || locked
          ? () => void startForgot()
          : undefined
      }
      onAddPhone={() => {
        close(false);
        router.push({
          pathname: '/auth/add-phone',
          params: {
            returnTo:
              pathname === '/settings/security' ? '/settings/security?changePasscode=1' : pathname,
          },
        } as unknown as Href);
      }}
    />
  );

  return { requestChange, modal };
}
