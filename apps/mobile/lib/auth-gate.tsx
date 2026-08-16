import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type AuthGateValue = {
  tagConfigured: boolean;
  markTagConfigured: () => void;
  markTagUnconfigured: () => void;
};

const AuthGateContext = createContext<AuthGateValue | null>(null);

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error('useAuthGate must be used within AuthGateProvider');
  }
  return ctx;
}

type ProviderProps = {
  tagConfigured: boolean;
  children: ReactNode;
};

export function AuthGateProvider({ tagConfigured: initialTagConfigured, children }: ProviderProps) {
  const [tagConfigured, setTagConfiguredState] = useState(initialTagConfigured);

  useEffect(() => {
    setTagConfiguredState(initialTagConfigured);
  }, [initialTagConfigured]);

  const markTagConfigured = useCallback(() => {
    setTagConfiguredState(true);
  }, []);

  const markTagUnconfigured = useCallback(() => {
    setTagConfiguredState(false);
  }, []);

  const value = useMemo(
    () => ({
      tagConfigured,
      markTagConfigured,
      markTagUnconfigured,
    }),
    [tagConfigured, markTagConfigured, markTagUnconfigured],
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}
