import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** Sheet heights: system medium/large, a screen fraction, or fixed points. */
export type SheetDetent = 'medium' | 'large' | { fraction: number } | { height: number };

export type SheetModalProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called once the sheet has fully closed. Present follow-up screens (pickers,
   * other sheets) from here; iOS can't present while a sheet is dismissing.
   */
  onDismissed?: () => void;
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
  /** Let content run under the bottom safe area (e.g. a full-bleed camera). */
  edgeToEdge?: boolean;
  /** Paint the sheet surface itself instead of the system material. */
  backgroundColor?: string;
};
