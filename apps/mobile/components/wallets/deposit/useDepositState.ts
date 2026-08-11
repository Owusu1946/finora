import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Share } from 'react-native';

import { CRYPTO_DEPOSIT_NETWORKS, type CryptoNetworkId } from '@/lib/crypto-networks';
import { haptics } from '@/lib/haptics';
import { MOMO_NETWORKS, type MomoNetworkId } from '@/lib/momo-networks';
import { pickPhoneFromContacts } from '@/lib/pick-phone-contact';

import type { DepositModalProps, DepositState, DepositStep } from './types';

import { MOMO_FEE_RATE } from './constants';

export function useDepositState({
  visible,
  selectedWallet,
  onClose,
  onCopy,
}: DepositModalProps): DepositState {
  const [step, setStep] = useState<DepositStep>('methods');
  const [networkId, setNetworkId] = useState<CryptoNetworkId>('base');
  const [asset, setAsset] = useState<'USDT' | 'USDC'>('USDT');
  const [momoNetwork, setMomoNetwork] = useState<MomoNetworkId>('mtn');
  const [phone, setPhone] = useState('0550123456');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);

  const network = useMemo(
    () => CRYPTO_DEPOSIT_NETWORKS.find((n) => n.id === networkId) ?? CRYPTO_DEPOSIT_NETWORKS[0]!,
    [networkId],
  );

  const amountNum = parseFloat(amount) || 0;
  const momoFee = amountNum > 0 ? amountNum * MOMO_FEE_RATE : 0;
  const momoNetworkLabel = MOMO_NETWORKS.find((n) => n.id === momoNetwork)?.name ?? 'MoMo';

  useEffect(() => {
    if (!visible) {
      setStep('methods');
      setCopied(false);
      setAmount('');
      Keyboard.dismiss();
      return;
    }
    const c = selectedWallet?.currency;
    if (c === 'USDC') setAsset('USDC');
    else if (c === 'USDT') setAsset('USDT');
    if (selectedWallet?.type === 'crypto') {
      const badge = selectedWallet.badge.toLowerCase();
      if (badge.includes('sol')) setNetworkId('solana');
      else if (badge.includes('trc') || badge.includes('tron')) setNetworkId('tron');
      else setNetworkId('base');
    }
  }, [visible, selectedWallet]);

  const handleClose = () => {
    setStep('methods');
    onClose();
  };

  const handleCopyAddress = async (value: string, label: string) => {
    haptics.selection();
    await Clipboard.setStringAsync(value);
    onCopy(value, label);
    setCopied(true);
    haptics.success();
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async (message: string, title: string) => {
    haptics.selection();
    try {
      await Share.share({ message, title });
    } catch {
      // ignored
    }
  };

  const handlePickContact = async () => {
    haptics.selection();
    Keyboard.dismiss();
    try {
      const picked = await pickPhoneFromContacts();
      if (picked) {
        setPhone(picked);
        haptics.success();
      }
    } catch {
      // User cancelled or picker unavailable.
    }
  };

  return {
    step,
    setStep,
    networkId,
    setNetworkId,
    asset,
    setAsset,
    momoNetwork,
    setMomoNetwork,
    phone,
    setPhone,
    amount,
    setAmount,
    copied,
    amountNum,
    momoFee,
    momoNetworkLabel,
    network,
    handleClose,
    handleCopyAddress,
    handleShare,
    handlePickContact,
  };
}
