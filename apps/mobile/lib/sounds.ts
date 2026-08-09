import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

const paymentSuccessSource = require('@/assets/sounds/payment-success.mp3');

let configured = false;
let paymentPlayer: AudioPlayer | null = null;

async function ensureAudioMode() {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  } catch {
    // Expo Go / web may not support every mode flag.
  }
}

function getPaymentPlayer() {
  if (!paymentPlayer) {
    paymentPlayer = createAudioPlayer(paymentSuccessSource);
  }
  return paymentPlayer;
}

/**
 * Short confirmation ding for successful money movement.
 * Safe to call fire-and-forget; no-ops on web / failures.
 */
export async function playPaymentSuccessSound() {
  if (Platform.OS === 'web') return;

  try {
    await ensureAudioMode();
    const player = getPaymentPlayer();
    await player.seekTo(0);
    player.play();
  } catch {
    // Sound is a nice-to-have; never block the success UI.
  }
}
