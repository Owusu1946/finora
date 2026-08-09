import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

/** Strip to digits and normalize Ghana numbers to 0XXXXXXXXX when possible. */
export function normalizePhoneNumber(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Opens the native contact picker and returns the first phone number, if any.
 * Uses `presentContactPickerAsync` (Expo SDK 54).
 */
export async function pickPhoneFromContacts(): Promise<string | null> {
  if (Platform.OS === 'android') {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return null;
  }

  const contact = await Contacts.presentContactPickerAsync();
  if (!contact?.phoneNumbers?.length) return null;

  const number = contact.phoneNumbers.find((p) => p.number?.trim())?.number;
  if (!number) return null;

  return normalizePhoneNumber(number);
}
