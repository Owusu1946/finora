import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PasscodeGateValue = {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
};

const PasscodeGateContext = createContext<PasscodeGateValue | null>(null);

export function usePasscodeGate() {
  const context = useContext(PasscodeGateContext);
  if (!context) throw new Error('usePasscodeGate must be used within PasscodeGateProvider.');
  return context;
}

export function PasscodeGateProvider({
  initiallyLocked,
  children,
}: {
  initiallyLocked: boolean;
  children: ReactNode;
}) {
  const [locked, setLocked] = useState(initiallyLocked);

  useEffect(() => {
    setLocked(initiallyLocked);
  }, [initiallyLocked]);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);
  const value = useMemo(() => ({ locked, lock, unlock }), [lock, locked, unlock]);

  return <PasscodeGateContext.Provider value={value}>{children}</PasscodeGateContext.Provider>;
}
