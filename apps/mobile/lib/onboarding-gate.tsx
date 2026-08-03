import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type OnboardingGateValue = {
  completed: boolean;
  markCompleted: () => void;
  markIncomplete: () => void;
};

const OnboardingGateContext = createContext<OnboardingGateValue | null>(null);

export function useOnboardingGate() {
  const ctx = useContext(OnboardingGateContext);
  if (!ctx) {
    throw new Error('useOnboardingGate must be used within OnboardingGateProvider');
  }
  return ctx;
}

type ProviderProps = {
  completed: boolean;
  children: ReactNode;
};

export function OnboardingGateProvider({ completed: initialCompleted, children }: ProviderProps) {
  const [completed, setCompleted] = useState(initialCompleted);

  const markCompleted = useCallback(() => {
    setCompleted(true);
  }, []);

  const markIncomplete = useCallback(() => {
    setCompleted(false);
  }, []);

  const value = useMemo(
    () => ({
      completed,
      markCompleted,
      markIncomplete,
    }),
    [completed, markCompleted, markIncomplete],
  );

  return <OnboardingGateContext.Provider value={value}>{children}</OnboardingGateContext.Provider>;
}
