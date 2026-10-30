/**
 * Lets code outside the assistant runtime (notifications, screens) ask for a
 * chat to open. `OpenThreadBridge`, inside the runtime, does the switching.
 */
type Listener = (chatId: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function requestOpenThread(chatId: string) {
  if (listeners.size === 0) {
    pending = chatId;
    return;
  }
  for (const listener of listeners) listener(chatId);
}

export function subscribeOpenThread(listener: Listener) {
  listeners.add(listener);
  if (pending) {
    const chatId = pending;
    pending = null;
    listener(chatId);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The chat every automation posts to (mirrors the API's automationsChatId). */
export function automationsChatId(userId: string) {
  return `automations_${userId}`;
}

/** The device's IANA timezone, e.g. Africa/Accra. */
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Accra';
  } catch {
    return 'Africa/Accra';
  }
}
