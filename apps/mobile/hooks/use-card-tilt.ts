import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

const MAX_TILT = 1;
const SMOOTH = 0.2;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Device-tilt shared values for metal/gloss card lighting.
 * Uses DeviceMotion orientation (beta/gamma). Falls back to idle on web/unavailable.
 */
export function useCardTilt(
  enabled = true,
  onFlipGesture?: () => void,
): {
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
} {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const onFlipGestureRef = useRef(onFlipGesture);
  onFlipGestureRef.current = onFlipGesture;

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;
    let baselineBeta: number | null = null;
    let baselineGamma: number | null = null;
    let flipLatched = false;
    let lastFlipAt = 0;

    const tick = () => {
      currentX += (targetX - currentX) * SMOOTH;
      currentY += (targetY - currentY) * SMOOTH;
      tiltX.value = currentX;
      tiltY.value = currentY;
      raf = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        const available = await DeviceMotion.isAvailableAsync();
        if (!available || cancelled) return;

        const perm = await DeviceMotion.getPermissionsAsync();
        if (!perm.granted) {
          const asked = await DeviceMotion.requestPermissionsAsync();
          if (!asked.granted || cancelled) return;
        }

        DeviceMotion.setUpdateInterval(32);
        sub = DeviceMotion.addListener((m) => {
          const beta = m.rotation?.beta ?? 0;
          const gamma = m.rotation?.gamma ?? 0;

          // Treat the first reading as neutral. A fixed beta baseline can put
          // the gloss outside the card depending on how the phone is held.
          baselineBeta ??= beta;
          baselineGamma ??= gamma;

          const deltaBeta = beta - baselineBeta;
          const deltaGamma = gamma - baselineGamma;
          const nx = clamp(-deltaBeta / 0.38, -MAX_TILT, MAX_TILT);
          const ny = clamp(deltaGamma / 0.34, -MAX_TILT, MAX_TILT);
          const wristSpeed = Math.abs(m.rotationRate?.gamma ?? 0);

          // Ignore tiny sensor noise while the phone is still.
          targetX = Math.abs(nx) < 0.025 ? 0 : nx;
          targetY = Math.abs(ny) < 0.025 ? 0 : ny;

          // Require both a pronounced angle and active wrist rotation. The
          // latch and cooldown prevent normal card parallax from retriggering.
          const now = Date.now();
          if (
            onFlipGestureRef.current &&
            !flipLatched &&
            now - lastFlipAt > 1_800 &&
            Math.abs(deltaGamma) > 0.68 &&
            wristSpeed > 85
          ) {
            flipLatched = true;
            lastFlipAt = now;
            onFlipGestureRef.current();
          } else if (Math.abs(deltaGamma) < 0.28) {
            flipLatched = false;
          }
        });
        raf = requestAnimationFrame(tick);
      } catch {
        // Simulator / denied — leave at rest
      }
    };

    void start();

    return () => {
      cancelled = true;
      sub?.remove();
      if (raf) cancelAnimationFrame(raf);
      tiltX.value = 0;
      tiltY.value = 0;
    };
  }, [enabled, tiltX, tiltY]);

  return { tiltX, tiltY };
}
