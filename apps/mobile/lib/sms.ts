import * as SMS from 'expo-sms';

export type SendSmsResult =
  | { ok: true; result: 'sent' | 'cancelled' | 'unknown' }
  | { ok: false; error: string };

/** Whether the device can open the system SMS composer. False on most simulators. */
export async function isSmsAvailable() {
  try {
    return await SMS.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Opens the system SMS UI with optional recipients and a prefilled body.
 * Does not read the inbox — Expo SMS is send-only.
 */
export async function sendSms(input: {
  addresses?: string | string[];
  message: string;
}): Promise<SendSmsResult> {
  const available = await isSmsAvailable();
  if (!available) {
    return {
      ok: false,
      error: 'SMS isn’t available on this device. Try a physical phone.',
    };
  }

  const addresses = Array.isArray(input.addresses)
    ? input.addresses.filter(Boolean)
    : input.addresses
      ? [input.addresses]
      : [];

  try {
    const { result } = await SMS.sendSMSAsync(addresses, input.message);
    return { ok: true, result };
  } catch {
    return { ok: false, error: 'Couldn’t open the SMS composer.' };
  }
}
