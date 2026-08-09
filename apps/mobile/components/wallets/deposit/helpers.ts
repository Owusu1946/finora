import type { DepositStep } from './types';

export function getSheetTitle(step: DepositStep) {
  if (step === 'methods') return 'Account type';
  if (step === 'finora_user') return 'Receive from Finora';
  if (step === 'stablecoin' || step === 'network_picker') return 'Receive stablecoin';
  if (step === 'momo' || step === 'momo_network_picker') return 'Mobile money';
  return 'Add funds';
}

export function shouldShowBack(step: DepositStep) {
  return (
    step !== 'methods' &&
    step !== 'network_picker' &&
    step !== 'momo_network_picker' &&
    step !== 'momo_awaiting' &&
    step !== 'momo_completed'
  );
}

export function isMomoFlowStep(step: DepositStep) {
  return step === 'momo' || step === 'momo_awaiting' || step === 'momo_completed';
}

export function isPickerStep(step: DepositStep): step is 'network_picker' | 'momo_network_picker' {
  return step === 'network_picker' || step === 'momo_network_picker';
}
