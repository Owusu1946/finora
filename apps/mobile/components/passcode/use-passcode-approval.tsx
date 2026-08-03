import { useCallback, useRef, useState } from 'react';

import { PasscodeModal, type PasscodeMode } from '@/components/passcode/PasscodeModal';
import { haptics } from '@/lib/haptics';
import { hasPasscode, setPasscode, verifyPasscode } from '@/lib/passcode-storage';

type GatePhase = 'closed' | 'setup' | 'confirm-setup' | 'unlock';

/**
 * Opens passcode setup (first time) or unlock, then resolves true if approved.
 */
export function usePasscodeApproval() {
  const [phase, setPhase] = useState<GatePhase>('closed');
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

  const requestApproval = useCallback(async () => {
    const exists = await hasPasscode();
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setError(null);
      setDraft('');
      setPadKey((k) => k + 1);
      setPhase(exists ? 'unlock' : 'setup');
    });
  }, []);

  const onComplete = useCallback(
    async (code: string) => {
      if (phase === 'setup') {
        setDraft(code);
        setError(null);
        setPadKey((k) => k + 1);
        setPhase('confirm-setup');
        return;
      }

      if (phase === 'confirm-setup') {
        if (code !== draft) {
          haptics.impact();
          setError('Passcodes don’t match. Try again.');
          setDraft('');
          setPadKey((k) => k + 1);
          setPhase('setup');
          return;
        }
        await setPasscode(code);
        haptics.success();
        close(true);
        return;
      }

      if (phase === 'unlock') {
        const ok = await verifyPasscode(code);
        if (!ok) {
          haptics.impact();
          setError('Incorrect passcode.');
          setPadKey((k) => k + 1);
          return;
        }
        haptics.success();
        close(true);
      }
    },
    [close, draft, phase],
  );

  const mode: PasscodeMode =
    phase === 'confirm-setup' ? 'confirm-setup' : phase === 'setup' ? 'setup' : 'unlock';

  const modal = (
    <PasscodeModal
      key={padKey}
      visible={phase !== 'closed'}
      mode={mode}
      error={error}
      onClose={() => close(false)}
      onComplete={onComplete}
    />
  );

  return { requestApproval, modal };
}
