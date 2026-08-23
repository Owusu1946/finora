import { useRouter, type Href } from 'expo-router';

import { PasscodeView } from '@/components/passcode/PasscodeView';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { usePasscodeGate } from '@/lib/passcode-gate';
import { verifyPasscode } from '@/lib/passcode-storage';

export default function EnterPasscodeScreen() {
  const router = useRouter();
  const { markTagConfigured } = useAuthGate();
  const { unlock } = usePasscodeGate();

  const handleVerify = async (code: string) => {
    return verifyPasscode(code);
  };

  const handleSuccess = () => {
    markTagConfigured();
    unlock();
    haptics.success();
    router.replace('/(app)' as Href);
  };

  const handleBiometricUnlock = () => {
    markTagConfigured();
    unlock();
    haptics.success();
    router.replace('/(app)' as Href);
    return true;
  };

  return (
    <PasscodeView
      mode='enter'
      onVerify={handleVerify}
      onSuccess={handleSuccess}
      onBiometricUnlock={handleBiometricUnlock}
    />
  );
}
