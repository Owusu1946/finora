import { MenuView } from '@expo/ui/community/menu';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { ATTACH_ACTIONS, type AttachMenuProps } from './attach-menu.types';

/** Native Material dropdown menu (Android), in a fixed slot so the row never shifts. */
export function AttachMenu({ size, onSelect, children }: AttachMenuProps) {
  const { isDark } = useTheme();

  return (
    // Claim the React Native touch so it never reaches the composer's tap-to-focus shell.
    <View
      onStartShouldSetResponder={() => true}
      style={{ width: size, height: size }}
    >
      <MenuView
        actions={ATTACH_ACTIONS}
        colorScheme={isDark ? 'dark' : 'light'}
        onOpenMenu={haptics.selection}
        onPressAction={({ nativeEvent }) => {
          const action = ATTACH_ACTIONS.find((item) => item.id === nativeEvent.event);
          if (action) onSelect(action.id);
        }}
      >
        {children}
      </MenuView>
    </View>
  );
}
