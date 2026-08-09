import {
  BaseLogo,
  EthereumLogo,
  SolanaLogo,
  TronLogo,
} from '@/components/ui/chain-logos';
import { AirtelTigoLogo, MtnLogo, TelecelLogo } from '@/components/ui/momo-logos';
import type { CryptoNetworkId } from '@/lib/crypto-networks';
import type { MomoNetworkId } from '@/lib/momo-networks';

export function ChainIcon({ id, size = 36 }: { id: CryptoNetworkId; size?: number }) {
  switch (id) {
    case 'base':
      return <BaseLogo size={size} />;
    case 'ethereum':
      return <EthereumLogo size={size} />;
    case 'solana':
      return <SolanaLogo size={size} />;
    case 'tron':
      return <TronLogo size={size} />;
  }
}

export function MomoIcon({ id, size = 36 }: { id: MomoNetworkId; size?: number }) {
  switch (id) {
    case 'mtn':
      return <MtnLogo size={size} />;
    case 'telecel':
      return <TelecelLogo size={size} />;
    case 'airteltigo':
      return <AirtelTigoLogo size={size} />;
  }
}
