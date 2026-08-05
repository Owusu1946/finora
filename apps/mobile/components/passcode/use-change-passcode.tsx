import { useCallback, useRef, useState } from 'react';

import { PasscodeModal, type PasscodeMode } from '@/components/passcode/PasscodeModal';
import { haptics } from '@/lib/haptics';
import { hasPasscode, setPasscode, verifyPasscode } from '@/lib/passcode-storage';

type ChangePhase =
  | 'closed'
  | 'unlock'
  | 'setup'
  | 'confirm-setup'
  | 'create-setup'
  | 'create-confirm';

/**
 * Change existing passcode (verify → new → confirm) or create if none exists.
 */
export function useChangePasscode() {
  const [phase, setPhase] = useState<ChangePhase>('closed');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const close = useCallback((ok: boolean) => {
    setPhase('closed');
    setDraft('');
    setError(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(ok);
  }, []);

  const requestChange = useCallback(async () => {
    const exists = await hasPasscode();
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setError(null);
      setDraft('');
      setPadKey((k) => k + 1);
      setPhase(exists ? 'unlock' : 'create-setup');
    });
  }, []);

  const onComplete = useCallback(
    async (code: string) => {
      if (phase === 'unlock') {
        const ok = await verifyPasscode(code);
        if (!ok) {
          haptics.impact();
          setError('Incorrect passcode.');
          setPadKey((k) => k + 1);
          return;
        }
        setError(null);
        setPadKey((k) => k + 1);
        setPhase('setup');
        return;
      }

      if (phase === 'setup' || phase === 'create-setup') {
        setDraft(code);
        setError(null);
        setPadKey((k) => k + 1);
        setPhase(phase === 'create-setup' ? 'create-confirm' : 'confirm-setup');
        return;
      }

      if (phase === 'confirm-setup' || phase === 'create-confirm') {
        if (code !== draft) {
          haptics.impact();
          setError('Passcodes don’t match. Try again.');
          setDraft('');
          setPadKey((k) => k + 1);
          setPhase(phase === 'create-confirm' ? 'create-setup' : 'setup');
          return;
        }
        await setPasscode(code);
        haptics.success();
        close(true);
      }
    },
    [close, draft, phase],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup' || phase === 'create-confirm'
      ? 'confirm-setup'
      : phase === 'setup' || phase === 'create-setup'
        ? 'setup'
        : 'unlock';

  const title =
    phase === 'unlock'
      ? 'Current passcode'
      : phase === 'setup' || phase === 'create-setup'
        ? 'New passcode'
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
      key={padKey}
      visible={phase !== 'closed'}
      mode={mode}
      title={title}
      subtitle={subtitle}
      error={error}
      onClose={() => close(false)}
      onComplete={onComplete}
    />
  );

  return { requestChange, modal };
}
