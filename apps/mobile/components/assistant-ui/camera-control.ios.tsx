import { Host } from '@expo/ui';
import { Button, type ButtonProps } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

import { haptics } from '@/lib/haptics';

import type { CameraControlKind, CameraControlProps } from './camera-control.types';

const SYMBOLS: Record<CameraControlKind, NonNullable<ButtonProps['systemImage']>> = {
  back: 'chevron.left',
  more: 'ellipsis',
  close: 'xmark',
  'flash-on': 'bolt.fill',
  'flash-off': 'bolt.slash',
  flip: 'arrow.triangle.2.circlepath.camera',
};

const liquidGlass = isLiquidGlassAvailable();

/** Native SwiftUI glass button (bordered on iOS before 26) over the camera feed. */
export function CameraControl({ kind, label, onPress }: CameraControlProps) {
  return (
    <Host
      matchContents
      colorScheme='dark'
    >
      <Button
        label={label}
        systemImage={SYMBOLS[kind]}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle(liquidGlass ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('extraLarge'),
          foregroundStyle('#ffffff'),
        ]}
      />
    </Host>
  );
}
