import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthGateValue = {
  authenticated: boolean;
  markAuthenticated: () => void;
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
  children: ReactNode;
};

export function AuthGateProvider({ authenticated: initial, children }: ProviderProps) {
  const [authenticated, setAuthenticated] = useState(initial);

  const markAuthenticated = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const markSignedOut = useCallback(() => {
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      markAuthenticated,
      markSignedOut,
    }),
    [authenticated, markAuthenticated, markSignedOut],
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}
