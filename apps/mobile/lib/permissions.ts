import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Alert, Platform, type AlertButton } from 'react-native';

type PermissionResponse = {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined' | string;
};

type PermissionAction = {
  check: () => Promise<PermissionResponse>;
  request: () => Promise<PermissionResponse>;
};

/**
 * Requests a native permission and gives denied users an actionable Settings path.
 * Returns false when the action should stop.
 */
async function ensurePermission(action: PermissionAction, title: string, message: string) {
  const current = await action.check();
  if (current.granted) return true;

  if (current.status === 'undetermined') {
    const requested = await action.request();
    if (requested.granted) return true;
  }

  showSettingsAlert(title, message);
  return false;
}

function showSettingsAlert(title: string, message: string) {
  const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];

  if (Platform.OS !== 'web') {
    buttons.push({ text: 'Open Settings', onPress: () => void Linking.openSettings() });
  }

  Alert.alert(title, message, buttons);
}

export async function ensureMediaLibraryPermission(message: string) {
  return ensurePermission(
    {
      check: () => ImagePicker.getMediaLibraryPermissionsAsync(),
      request: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    },
    'Photo access needed',
    message,
  );
}

export async function ensureSaveToLibraryPermission() {
  return ensureMediaLibraryPermission('Allow photo access in Settings to save your code.');
}

export async function ensureContactsPermission() {
  return ensurePermission(
    {
      check: () => Contacts.getPermissionsAsync(),
      request: () => Contacts.requestPermissionsAsync(),
    },
    'Contacts access needed',
    'Allow contacts access in Settings to pick a phone number.',
  );
}
