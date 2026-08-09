import { useCallback, useRef, useState } from 'react';

import {
  MAX_ATTEMPTS,
  PasscodeModal,
  type PasscodeMode,
} from '@/components/passcode/PasscodeModal';
import { checkForgetPasswordOtp, requestPasswordReset } from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';
import {
  clearPasscode,
  hasPasscode,
  setPasscode,
  verifyPasscode,
} from '@/lib/passcode-storage';
import { getCachedSettings } from '@/lib/settings-storage';

type GatePhase = 'closed' | 'setup' | 'confirm-setup' | 'unlock' | 'forgot-otp';

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'•'.repeat(Math.max(1, user.length - head.length))}@${domain}`;
}

/**
 * Opens passcode setup (first time) or unlock, then resolves true if approved.
 * Wrong unlock codes shake + vibrate; 3 fails lock the pad and require email OTP reset.
 */
export function usePasscodeApproval() {
  const [phase, setPhase] = useState<GatePhase>('closed');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failureSignal, setFailureSignal] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [locked, setLocked] = useState(false);
  const [forgotHint, setForgotHint] = useState<string | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const recoveringRef = useRef(false);

  const markFailure = useCallback((message: string) => {
    setError(message);
    setFailureSignal((n) => n + 1);
  }, []);

  const close = useCallback((ok: boolean) => {
    setPhase('closed');
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
    const email = getCachedSettings().email.trim();
    if (!email.includes('@')) {
      haptics.error();
      setError('Add an email in Settings → Account before resetting.');
      return;
    }
    setError(null);
    const result = await requestPasswordReset(email);
    if (!result.ok) {
      haptics.error();
      setError(result.error ?? 'Could not send reset code.');
      return;
    }
    haptics.success();
    recoveringRef.current = true;
    setLocked(false);
    setForgotHint(maskEmail(email));
    setError(null);
    setPhase('forgot-otp');
  }, []);

  const onComplete = useCallback(
    async (code: string) => {
      if (phase === 'setup') {
        setDraft(code);
        setError(null);
        setPhase('confirm-setup');
        return;
      }

      if (phase === 'confirm-setup') {
        if (code !== draft) {
          markFailure('Passcodes don’t match. Try again.');
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
        const email = getCachedSettings().email.trim();
        const result = await checkForgetPasswordOtp(email, code);
        if (!result.ok) {
          markFailure(result.error ?? 'That code is incorrect.');
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
            markFailure('Too many attempts. Reset with the code sent to your email.');
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
    [attemptsLeft, close, draft, locked, markFailure, phase, startForgot],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup'
      ? 'confirm-setup'
      : phase === 'setup'
        ? 'setup'
        : phase === 'forgot-otp'
          ? 'forgot-otp'
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
