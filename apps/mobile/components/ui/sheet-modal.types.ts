import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** Sheet heights: system medium/large, a screen fraction, or fixed points. */
export type SheetDetent = 'medium' | 'large' | { fraction: number } | { height: number };

export type SheetModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Styles for the sheet content (not the scrim). */
  style?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  keyboardAvoiding?: boolean;
  /** Dim strength 0–1 for the JS fallback sheet. Default 0.4 */
  dimOpacity?: number;
  /**
   * Fixed sheet heights for scrollable content. Omit to size the sheet to its
   * content.
   */
  detents?: SheetDetent[];
};
