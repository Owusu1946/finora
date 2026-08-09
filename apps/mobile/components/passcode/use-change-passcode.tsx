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

type ChangePhase =
  | 'closed'
  | 'unlock'
  | 'setup'
  | 'confirm-setup'
  | 'create-setup'
  | 'create-confirm'
  | 'forgot-otp';

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'•'.repeat(Math.max(1, user.length - head.length))}@${domain}`;
}

/**
 * Change existing passcode (verify → new → confirm) or create if none exists.
 * Unlock attempts shake on failure; 3 fails require email OTP reset.
 */
export function useChangePasscode() {
  const [phase, setPhase] = useState<ChangePhase>('closed');
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
    const email = getCachedSettings().email.trim();
    if (!email.includes('@')) {
      haptics.error();
      setError('Add an email in Settings → Account before resetting.');
      return;
    }
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
        setError(null);
        setPhase('setup');
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

      if (phase === 'setup' || phase === 'create-setup') {
        setDraft(code);
        setError(null);
        setPhase(phase === 'create-setup' ? 'create-confirm' : 'confirm-setup');
        return;
      }

      if (phase === 'confirm-setup' || phase === 'create-confirm') {
        if (code !== draft) {
          markFailure('Passcodes don’t match. Try again.');
          setDraft('');
          setPhase(phase === 'create-confirm' ? 'create-setup' : 'setup');
          return;
        }
        await setPasscode(code);
        haptics.success();
        close(true);
      }
    },
    [attemptsLeft, close, draft, locked, markFailure, phase, startForgot],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup' || phase === 'create-confirm'
      ? 'confirm-setup'
      : phase === 'setup' || phase === 'create-setup'
        ? 'setup'
        : phase === 'forgot-otp'
          ? 'forgot-otp'
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
    />
  );

  return { requestChange, modal };
}
