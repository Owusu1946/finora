import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';

type PersonalQrProfile = {
  displayName: string;
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
};

/** Build the current user's receive QR from a verified mobile-money number. */
export function buildPersonalReceiveMethod(profile: PersonalQrProfile): ReceiveMethod | null {
  if (!profile.phoneNumber || !profile.phoneVerifiedAt) return null;

  return {
    id: 'personal-momo',
    kind: 'mobile_money',
    currency: 'GHS',
    title: profile.displayName,
    subtitle: 'Scan or share to receive GHS',
    qrPayload: `finora:momo:ghs:${profile.phoneNumber}`,
    fields: [
      { label: 'Account name', value: profile.displayName },
      { label: 'MoMo number', value: profile.phoneNumber },
    ],
  };
}
