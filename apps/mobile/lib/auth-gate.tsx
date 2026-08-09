import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthGateValue = {
  authenticated: boolean;
  tagConfigured: boolean;
  markAuthenticated: () => void;
  markTagConfigured: () => void;
  markSignedOut: () => void;
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
  authenticated: boolean;
  tagConfigured: boolean;
  children: ReactNode;
};

export function AuthGateProvider({
  authenticated: initialAuth,
  tagConfigured: initialTagConfigured,
  children,
}: ProviderProps) {
  const [authenticated, setAuthenticated] = useState(initialAuth);
  const [tagConfigured, setTagConfiguredState] = useState(initialTagConfigured);

  const markAuthenticated = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const markTagConfigured = useCallback(() => {
    setTagConfiguredState(true);
  }, []);

  const markSignedOut = useCallback(() => {
    setAuthenticated(false);
    setTagConfiguredState(false);
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      tagConfigured,
      markAuthenticated,
      markTagConfigured,
      markSignedOut,
    }),
    [authenticated, tagConfigured, markAuthenticated, markTagConfigured, markSignedOut],
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}
