import { useRouter, type Href } from 'expo-router';

import { PasscodeView } from '@/components/passcode/PasscodeView';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { verifyPasscode } from '@/lib/passcode-storage';

export default function EnterPasscodeScreen() {
  const router = useRouter();
  const { markTagConfigured } = useAuthGate();

  const handleVerify = async (code: string) => {
    return verifyPasscode(code);
  };

  const handleSuccess = () => {
    markTagConfigured();
    haptics.success();
    router.replace('/(app)' as Href);
  };

  return (
    <PasscodeView
      mode='enter'
      onVerify={handleVerify}
      onSuccess={handleSuccess}
    />
  );
}
