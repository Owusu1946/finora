import { Host } from '@expo/ui';
import { Button, Menu, type ButtonProps } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ATTACH_ACTIONS, type AttachAction, type AttachMenuProps } from './attach-menu.types';

const SYMBOLS: Record<AttachAction, NonNullable<ButtonProps['systemImage']>> = {
  camera: 'camera',
  photo: 'photo.on.rectangle',
  document: 'doc',
};

/**
 * Native SwiftUI menu with a SwiftUI-drawn trigger. A React Native label
 * inside the menu rendered late and let taps reach the composer, so the
 * trigger is an SF Symbol and `children` is unused on iOS.
 */
export function AttachMenu({ size, label, onSelect }: AttachMenuProps) {
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
            foregroundStyle(colors.mutedForeground),
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
