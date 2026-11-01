import type { Payee } from '@finora/shared';

import { listPayeesOfKind } from './payees-api';

/**
 * Beneficiaries are the saved contacts on the Finora API, shown with their
 * payout method. None are verified until WeWire is live.
 */
export type Beneficiary = {
  id: string;
  name: string;
  method: 'bank' | 'mobile_money' | 'crypto';
  identifier: string;
  currency: string;
  country?: string;
  verified: boolean;
  beneficiaryAccountId?: string;
  rail?: string;
};

function toBeneficiary(payee: Payee): Beneficiary {
  return {
    id: payee.id,
    name: payee.name,
    method:
      payee.method === 'mobile_money'
        ? 'mobile_money'
        : payee.method === 'crypto_wallet'
          ? 'crypto'
          : 'bank',
    identifier: payee.identifier,
    currency: payee.currency,
    country: payee.country ?? undefined,
    verified: false,
    rail: payee.label,
  };
}

export async function listBeneficiaries(): Promise<Beneficiary[]> {
  return (await listPayeesOfKind('contact')).map(toBeneficiary);
}

/** Saved payees stay on the account; the payee cache is cleared with contacts. */
export async function clearBeneficiaries(): Promise<void> {}
