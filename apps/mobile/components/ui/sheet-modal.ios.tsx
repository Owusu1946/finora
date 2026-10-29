import { Host } from '@expo/ui';
import { BottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import {
  ignoreSafeArea,
  preferredColorScheme,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

import type { SheetModalProps } from './sheet-modal.types';

/**
 * Native SwiftUI sheet (Liquid Glass on iOS 26). Fits its content by default;
 * pass `detents` for scrollable content that needs a fixed sheet height.
 */
export function SheetModal({
  visible,
  onClose,
  children,
  style,
  showHandle = true,
  detents,
  edgeToEdge = false,
  backgroundColor,
}: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const fit = !detents;

  return (
    <Host
      matchContents
      style={{ position: 'absolute' }}
    >
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        fitToContents={fit}
      >
        <Group
          modifiers={[
            presentationDragIndicator(showHandle ? 'visible' : 'hidden'),
            preferredColorScheme(isDark ? 'dark' : 'light'),
            ...(detents ? [presentationDetents(detents)] : []),
            ...(backgroundColor ? [presentationBackground(backgroundColor)] : []),
            ...(edgeToEdge ? [ignoreSafeArea({ regions: 'container', edges: 'bottom' })] : []),
          ]}
        >
          <RNHostView matchContents={fit}>
            <View
              style={[
                {
                  paddingTop: showHandle ? 20 : 12,
                  paddingBottom: edgeToEdge ? 0 : Math.max(insets.bottom, 16),
                },
                fit ? null : { flex: 1 },
                style,
              ]}
            >
              {children}
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}
