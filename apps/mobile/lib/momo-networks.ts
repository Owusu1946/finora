export type MomoNetworkId = 'mtn' | 'telecel' | 'airteltigo';

export type MomoNetwork = {
  id: MomoNetworkId;
  name: string;
  currency: 'GHS';
};

export const MOMO_NETWORKS: MomoNetwork[] = [
  { id: 'mtn', name: 'MTN', currency: 'GHS' },
  { id: 'telecel', name: 'Telecel', currency: 'GHS' },
  { id: 'airteltigo', name: 'AT', currency: 'GHS' },
];
