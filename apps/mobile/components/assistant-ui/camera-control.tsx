import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';

import { Icon } from '@/components/ui/icon';
import { haptics } from '@/lib/haptics';

import {
  CAMERA_CONTROL_SIZE,
  type CameraControlKind,
  type CameraControlProps,
} from './camera-control.types';

const ICONS: Record<CameraControlKind, IconName> = {
  back: 'chevron-left',
  more: 'more',
  close: 'remove',
  'flash-on': 'flash',
  'flash-off': 'flash-off',
  flip: 'camera-flip',
};

/** Translucent round control with a Material ripple (Android and web). */
export function CameraControl({ kind, label, onPress }: CameraControlProps) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      android_ripple={{
        color: 'rgba(255, 255, 255, 0.24)',
        borderless: true,
        radius: CAMERA_CONTROL_SIZE / 2,
      }}
      style={styles.control}
    >
      <Icon
        name={ICONS[kind]}
        size={20}
        color='#ffffff'
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    width: CAMERA_CONTROL_SIZE,
    height: CAMERA_CONTROL_SIZE,
    borderRadius: CAMERA_CONTROL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
