export type CryptoNetworkId = 'base' | 'ethereum' | 'solana' | 'tron';

export type CryptoDepositNetwork = {
  id: CryptoNetworkId;
  name: string;
  /** Mock custody deposit address for demos. */
  address: string;
  assets: Array<'USDT' | 'USDC'>;
};

/** Stablecoin receive rails — WeWire-shaped network picker. */
export const CRYPTO_DEPOSIT_NETWORKS: CryptoDepositNetwork[] = [
  {
    id: 'base',
    name: 'BASE',
    address: '0x6BeA76b3159d78A9bf74Be1Ba5d970eBF7fc0a9b',
    assets: ['USDT', 'USDC'],
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    address: '0x6BeA76b3159d78A9bf74Be1Ba5d970eBF7fc0a9b',
    assets: ['USDT', 'USDC'],
  },
  {
    id: 'solana',
    name: 'Solana',
    address: '7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDvdssTZMU',
    assets: ['USDT', 'USDC'],
  },
  {
    id: 'tron',
    name: 'TRON',
    address: 'TXyzFinoraMockDepositAddress9hQ2',
    assets: ['USDT', 'USDC'],
  },
];

export function truncateAddress(address: string, head = 6, tail = 5) {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}
