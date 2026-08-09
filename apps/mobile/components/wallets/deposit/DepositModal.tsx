import React from 'react';
import { Modal, View } from 'react-native';

import { SheetModal } from '@/components/ui/sheet-modal';
import { useTheme } from '@/hooks/use-theme';

import { FinoraUserStep } from './FinoraUserStep';
import {
  getSheetTitle,
  isMomoFlowStep,
  isPickerStep,
  shouldShowBack,
} from './helpers';
import { MethodSelectionStep } from './MethodSelectionStep';
import { MomoFlowScreen } from './MomoFlowScreen';
import { getPickerCloseStep, NetworkPickerSheet } from './NetworkPickerSheet';
import { DepositSheetHeader } from './primitives';
import { StablecoinStep } from './StablecoinStep';
import { depositStyles as styles } from './styles';
import type { DepositModalProps } from './types';
import { useDepositState } from './useDepositState';

export function DepositModal({ visible, selectedWallet, onClose, onCopy }: DepositModalProps) {
  const { colors } = useTheme();
  const state = useDepositState({ visible, selectedWallet, onClose, onCopy });

  const {
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
  } = state;

  const isMomoFlow = isMomoFlowStep(step);

  // MoMo awaiting/completed is a full-screen focused flow, not a sheet.
  if (isMomoFlow) {
    return (
      <Modal
        visible={visible}
        animationType='slide'
        onRequestClose={handleClose}
      >
        <MomoFlowScreen
          step={step}
          colors={colors}
          momoNetwork={momoNetwork}
          momoNetworkLabel={momoNetworkLabel}
          phone={phone}
          amount={amount}
          amountNum={amountNum}
          momoFee={momoFee}
          onStepChange={setStep}
          onPhoneChange={setPhone}
          onAmountChange={setAmount}
          onPickContact={handlePickContact}
          onDone={handleClose}
        />
      </Modal>
    );
  }

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      keyboardAvoiding
      style={[styles.sheetContainer, step !== 'methods' && !isPickerStep(step) && styles.sheetTall]}
      showHandle={step === 'methods' || isPickerStep(step)}
    >
      {isPickerStep(step) ? (
        <NetworkPickerSheet
          step={step}
          colors={colors}
          networkId={networkId}
          momoNetwork={momoNetwork}
          onClose={() => setStep(getPickerCloseStep(step))}
          onSelectCrypto={(id) => {
            setNetworkId(id);
            setStep('stablecoin');
          }}
          onSelectMomo={(id) => {
            setMomoNetwork(id);
            setStep('momo');
          }}
        />
      ) : (
        <View style={styles.sheetBody}>
          <DepositSheetHeader
            title={getSheetTitle(step)}
            colors={colors}
            showBack={shouldShowBack(step)}
            onBack={() => setStep('methods')}
            onClose={handleClose}
          />

          {step === 'methods' ? (
            <MethodSelectionStep
              colors={colors}
              onSelect={setStep}
            />
          ) : null}

          {step === 'finora_user' ? (
            <FinoraUserStep
              colors={colors}
              copied={copied}
              onCopy={() => void handleCopyAddress('@kenneth', 'Finora tag')}
              onShare={() =>
                void handleShare('Send me money on Finora: @kenneth', 'Finora tag')
              }
            />
          ) : null}

          {step === 'stablecoin' ? (
            <StablecoinStep
              colors={colors}
              asset={asset}
              network={network}
              copied={copied}
              onAssetChange={setAsset}
              onOpenNetworkPicker={() => setStep('network_picker')}
              onCopy={() => void handleCopyAddress(network.address, 'Wallet address')}
              onShare={() =>
                void handleShare(
                  `Finora ${asset} · ${network.name}\n${network.address}`,
                  `Receive ${asset}`,
                )
              }
            />
          ) : null}
        </View>
      )}
    </SheetModal>
  );
}
