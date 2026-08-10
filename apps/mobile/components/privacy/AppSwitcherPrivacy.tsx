import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View, type AppStateStatus } from 'react-native';

import { FinoraMark } from '@/components/ui/finora-mark';
import { SPLASH_BACKGROUND } from '@/components/ui/finora-mark-paths';

const MARK_SIZE = 96;

/**
 * Branded privacy cover for the iOS App Switcher / Android Recents preview.
 *
 * Fintech apps should not leak balances or chat into the multitasking thumbnail.
 * WeWire-style: opaque splash + mark, not a live UI snapshot.
 *
 * Notes:
 * - Show on `inactive` (iOS snapshot timing) and `background`.
 * - Pure JS covers can race the OS snapshot; a native cover is more reliable in
 *   production builds. This still matches the standard Expo/RN approach and the
 *   Finora splash look without a custom native module.
 */
export function AppSwitcherPrivacy() {
  const appState = useRef(AppState.currentState);
  const [covered, setCovered] = useState(AppState.currentState !== 'active');

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      appState.current = next;
      // Cover whenever the app is not actively foregrounded so the OS snapshot
      // (taken around resign-active / pause) captures the splash, not the UI.
      setCovered(next !== 'active');
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return (
    <Modal
      visible={covered}
      animationType='none'
      transparent={false}
      statusBarTranslucent
      presentationStyle='fullScreen'
      onRequestClose={() => {}}
    >
      <View
        style={styles.root}
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
      >
        <FinoraMark
          size={MARK_SIZE}
          variant='bare'
          tone='light'
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
});
