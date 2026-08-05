import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getCachedSettings } from '@/lib/settings-storage';

const platformOk = Platform.OS === 'ios' || Platform.OS === 'android';

function enabled() {
  return platformOk && getCachedSettings().hapticsEnabled;
}

export const haptics = {
  selection() {
    if (enabled()) void Haptics.selectionAsync();
  },
  light() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  impact() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  success() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
