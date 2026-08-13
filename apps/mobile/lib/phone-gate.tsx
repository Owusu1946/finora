import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type PhoneGateStatus = 'loading' | 'required' | 'verified';

type PhoneGateValue = {
  status: PhoneGateStatus;
  setFromProfile: (phoneVerifiedAt: string | null) => void;
  markVerified: () => void;
  markLoading: () => void;
};

const PhoneGateContext = createContext<PhoneGateValue | null>(null);

export function usePhoneGate() {
  const context = useContext(PhoneGateContext);
  if (!context) throw new Error('usePhoneGate must be used within PhoneGateProvider.');
  return context;
}

export function PhoneGateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PhoneGateStatus>('loading');
  const setFromProfile = useCallback((phoneVerifiedAt: string | null) => {
    setStatus(phoneVerifiedAt ? 'verified' : 'required');
  }, []);
  const markVerified = useCallback(() => setStatus('verified'), []);
  const markLoading = useCallback(() => setStatus('loading'), []);

  const value = useMemo(
    () => ({ status, setFromProfile, markVerified, markLoading }),
    [markLoading, markVerified, setFromProfile, status],
  );

  return <PhoneGateContext.Provider value={value}>{children}</PhoneGateContext.Provider>;
}
