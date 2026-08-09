import type { CryptoNetworkId } from '@/lib/crypto-networks';
import type { MomoNetworkId } from '@/lib/momo-networks';

import type { WalletItem } from '../types';

export type DepositStep =
  | 'methods'
  | 'finora_user'
  | 'stablecoin'
  | 'momo'
  | 'momo_awaiting'
  | 'momo_completed'
  | 'network_picker'
  | 'momo_network_picker';

export type DepositMethodId = 'finora_user' | 'stablecoin' | 'mobile_money';

export type DepositPalette = {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  border: string;
};

export interface DepositModalProps {
  visible: boolean;
  selectedWallet: WalletItem | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

export type DepositState = {
  step: DepositStep;
  setStep: (step: DepositStep) => void;
  networkId: CryptoNetworkId;
  setNetworkId: (id: CryptoNetworkId) => void;
  asset: 'USDT' | 'USDC';
  setAsset: (asset: 'USDT' | 'USDC') => void;
  momoNetwork: MomoNetworkId;
  setMomoNetwork: (id: MomoNetworkId) => void;
  phone: string;
  setPhone: (phone: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  copied: boolean;
  amountNum: number;
  momoFee: number;
  momoNetworkLabel: string;
  network: (typeof import('@/lib/crypto-networks').CRYPTO_DEPOSIT_NETWORKS)[number];
  handleClose: () => void;
  handleCopyAddress: (value: string, label: string) => Promise<void>;
  handleShare: (message: string, title: string) => Promise<void>;
  handlePickContact: () => Promise<void>;
};
