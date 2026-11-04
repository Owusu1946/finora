import { Host } from '@expo/ui';
import { Button, Menu, type ButtonProps } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  menuIndicator,
  menuStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ATTACH_ACTIONS, type AttachAction, type AttachMenuProps } from './attach-menu.types';

const SYMBOLS: Record<AttachAction, NonNullable<ButtonProps['systemImage']>> = {
  camera: 'camera',
  photo: 'photo.on.rectangle',
  document: 'doc',
  scan: 'qrcode.viewfinder',
};

/**
 * Native SwiftUI menu with a SwiftUI-drawn trigger. A React Native label
 * inside the menu rendered late and let taps reach the composer, so the
 * trigger is an SF Symbol and `children` is unused on iOS.
 *
 * With `glass`, SwiftUI draws the trigger as a native Liquid Glass circle
 * (iOS 26+). Never nest this menu inside a React Native glass or blur view:
 * the trigger loses its frame and tint there.
 */
export function AttachMenu({ size, label, glass = false, onSelect }: AttachMenuProps) {
  const { colors, isDark } = useTheme();

  return (
    // Claim the React Native touch so a tap here never reaches the composer's
    // tap-to-focus shell (which would open the keyboard and close the menu).
    <View
      onStartShouldSetResponder={() => true}
      style={{ width: size, height: size }}
    >
      <Host
        style={{ width: size, height: size }}
        colorScheme={isDark ? 'dark' : 'light'}
      >
        <Menu
          label={label}
          systemImage='plus'
          modifiers={[
            labelStyle('iconOnly'),
            font({ size: 20, weight: 'regular' }),
            foregroundStyle(colors.foreground),
            // Menu triggers use the accent tint (blue) unless overridden.
            tint(colors.foreground),
            ...(glass
              ? [
                  menuStyle('button'),
                  menuIndicator('hidden'),
                  buttonStyle('glass'),
                  buttonBorderShape('circle'),
                  controlSize('large'),
                ]
              : []),
            frame({ width: size, height: size }),
          ]}
        >
          {ATTACH_ACTIONS.map((action) => (
            <Button
              key={action.id}
              label={action.title}
              systemImage={SYMBOLS[action.id]}
              onPress={() => onSelect(action.id)}
            />
          ))}
        </Menu>
      </Host>
    </View>
  );
}
