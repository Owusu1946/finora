import { useRouter, type Href } from 'expo-router';

import { PasscodeView } from '@/components/passcode/PasscodeView';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { setPasscode } from '@/lib/passcode-storage';

export default function CreatePasscodeScreen() {
  const router = useRouter();
  const { markTagConfigured } = useAuthGate();

  const handleSuccess = async (code: string) => {
    await setPasscode(code);
    markTagConfigured();
    haptics.success();
    router.replace('/(app)' as Href);
  };

  return (
    <PasscodeView
      mode='create'
      onSuccess={handleSuccess}
    />
  );
}
