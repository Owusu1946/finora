import { BottomSheet, Host, RNHostView, type SnapPoint } from '@expo/ui';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

import type { SheetDetent, SheetModalProps } from './sheet-modal.types';

function toSnapPoint(detent: SheetDetent): SnapPoint {
  if (detent === 'medium') return 'half';
  if (detent === 'large') return 'full';
  return detent;
}

/**
 * Native Material 3 bottom sheet (Compose ModalBottomSheet). Fits its content
 * by default; pass `detents` for scrollable content that needs a fixed height.
 */
export function SheetModal({
  visible,
  onClose,
  children,
  style,
  showHandle = true,
  dimOpacity = 0.4,
  detents,
}: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const fit = !detents;

  return (
    <Host
      matchContents
      style={{ position: 'absolute' }}
    >
      <BottomSheet
        isPresented={visible}
        onDismiss={onClose}
        showDragIndicator={showHandle}
        snapPoints={detents?.map(toSnapPoint)}
        containerColor={colors.card}
        contentColor={colors.foreground}
        scrimColor={`rgba(0, 0, 0, ${dimOpacity})`}
      >
        <RNHostView matchContents={fit}>
          <View
            style={[
              { paddingBottom: Math.max(insets.bottom, 16) },
              fit ? null : { flex: 1 },
              style,
            ]}
          >
            {children}
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
