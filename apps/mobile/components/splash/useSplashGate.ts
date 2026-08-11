import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** Restrained but clearly visible (~1.2–1.4s total). */
const REVEAL_MS = 900;
const HOLD_MS = 320;
const FADE_MS = 240;

function waitFrames(count: number) {
  return new Promise<void>((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function useSplashGate(bootReady: boolean) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const [overlayLaidOut, setOverlayLaidOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const progress = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  const onOverlayLayout = useCallback(() => {
    setOverlayLaidOut(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReducedMotion(enabled);
      setMotionReady(true);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!bootReady || !motionReady || !overlayLaidOut || dismissed) return;

    let cancelled = false;

    const finish = () => {
      if (!cancelled) setDismissed(true);
    };

    // Reset in case Strict Mode re-ran the effect after cleanup.
    cancelAnimation(progress);
    cancelAnimation(overlayOpacity);
    progress.value = 0;
    overlayOpacity.value = 1;

    void (async () => {
      // Let Skia paint the first frame before peeling away the native splash.
      await waitFrames(2);
      if (cancelled) return;

      try {
        await SplashScreen.hideAsync();
      } catch {
        // ignored
      }
      if (cancelled) return;

      // One more frame after native hide so the handoff isn't a blank tick.
      await waitFrames(1);
      if (cancelled) return;

      if (reducedMotion) {
        progress.value = 1;
        overlayOpacity.value = withDelay(
          HOLD_MS,
          withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished) runOnJS(finish)();
          }),
        );
        return;
      }

      progress.value = withTiming(
        1,
        { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          overlayOpacity.value = withDelay(
            HOLD_MS,
            withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
              if (done) runOnJS(finish)();
            }),
          );
        },
      );
    })();

    return () => {
      cancelled = true;
      cancelAnimation(progress);
      cancelAnimation(overlayOpacity);
    };
  }, [bootReady, motionReady, overlayLaidOut, dismissed, reducedMotion, progress, overlayOpacity]);

  return {
    showOverlay: !dismissed,
    reducedMotion,
    progress,
    overlayOpacity,
    onOverlayLayout,
  };
}
