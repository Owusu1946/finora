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

type GatePhase = 'closed' | 'setup' | 'confirm-setup' | 'unlock' | 'forgot-otp' | 'phone-required';

/**
 * Opens passcode setup (first time) or unlock, then resolves true if approved.
 * Wrong unlock codes shake + vibrate; 3 fails lock the pad and require SMS OTP reset.
 */
export function usePasscodeApproval() {
  const router = useRouter();
  const pathname = usePathname();
  const passcodeRecovery = usePasscodeRecovery();
  const [phase, setPhase] = useState<GatePhase>('closed');
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

  const requestApproval = useCallback(async () => {
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
      setPhase(exists ? 'unlock' : 'setup');
    });
  }, []);

  const startForgot = useCallback(async () => {
    setError(null);
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
      if (phase === 'setup') {
        draftRef.current = code;
        setDraft(code);
        setError(null);
        setPhase('confirm-setup');
        return;
      }

      if (phase === 'confirm-setup') {
        const expected = draftRef.current || draft;
        if (code !== expected) {
          markFailure('Passcodes don’t match. Try again.');
          draftRef.current = '';
          setDraft('');
          setPhase('setup');
          return;
        }
        await setPasscode(code);
        haptics.success();
        close(true);
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
        haptics.success();
        close(true);
      }
    },
    [attemptsLeft, close, draft, locked, markFailure, passcodeRecovery, phase, startForgot],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup'
      ? 'confirm-setup'
      : phase === 'setup'
        ? 'setup'
        : phase === 'forgot-otp'
          ? 'forgot-otp'
          : phase === 'phone-required'
            ? 'phone-required'
            : 'unlock';

  const modal = (
    <PasscodeModal
      visible={phase !== 'closed'}
      mode={mode}
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
          params: { returnTo: pathname },
        } as unknown as Href);
      }}
      title={
        recoveringRef.current && phase === 'setup'
          ? 'Create new passcode'
          : recoveringRef.current && phase === 'confirm-setup'
            ? 'Confirm new passcode'
            : undefined
      }
      subtitle={
        recoveringRef.current && phase === 'setup'
          ? 'Choose a new passcode for approving money moves.'
          : recoveringRef.current && phase === 'confirm-setup'
            ? 'Enter the same new passcode once more.'
            : undefined
      }
    />
  );

  return { requestApproval, modal };
}
