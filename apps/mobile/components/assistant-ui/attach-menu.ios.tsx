import { Host } from '@expo/ui';
import { Button, Menu, RNHostView, type ButtonProps } from '@expo/ui/swift-ui';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ATTACH_ACTIONS, type AttachAction, type AttachMenuProps } from './attach-menu.types';

const SYMBOLS: Record<AttachAction, NonNullable<ButtonProps['systemImage']>> = {
  camera: 'camera',
  photo: 'photo.on.rectangle',
  document: 'doc',
};

/**
 * Native SwiftUI menu. The host gets a fixed frame instead of measuring its
 * React Native label, which left it zero-sized in the composer row.
 */
export function AttachMenu({ size, onSelect, children }: AttachMenuProps) {
  const { isDark } = useTheme();

  return (
    <Host
      style={{ width: size, height: size }}
      colorScheme={isDark ? 'dark' : 'light'}
    >
      <Menu
        label={
          <RNHostView>
            {/* Claim the React Native touch so it doesn't bubble to the composer's
                tap-to-focus shell; SwiftUI still opens the menu natively. */}
            <View
              onStartShouldSetResponder={() => true}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {children}
            </View>
          </RNHostView>
        }
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
  );
}
