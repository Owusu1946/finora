import { BlurMask, Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type VoiceGlowPalette = {
  /** Brightest inner lobe */
  core: string;
  /** Supporting middle lobe */
  mid: string;
  /** Wide outer halo */
  outer: string;
};

type VoiceGlowProps = {
  /** Smoothed mic level 0–1. Shared value so Skia renders on the UI thread. */
  level: SharedValue<number>;
  /** True while transcription is running: sweeps a beam along the edge. */
  processing: boolean;
  colors: VoiceGlowPalette;
  borderRadius?: number;
  /** Sizing/position classes for the whole pill, applied to the wrapper. */
  className?: string;
  children: ReactNode;
};

// Canvas bleeds past the wrapper so blur and the traveling beam are not clipped.
const PAD = 26;
const BEAM_WIDTH = 64;

/**
 * Sound-reactive overlay for the voice pill: stacked teal lobes bloom along
 * its rounded edge with the mic level, above a resting hairline glow, plus a
 * traveling beam while transcription is in flight.
 */
export function VoiceGlow({
  level,
  processing,
  colors,
  borderRadius = 22,
  className,
  children,
}: VoiceGlowProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  // Repeated sweep along the edge, only meaningful while processing.
  const sweep = useSharedValue(0);
  const beamOpacity = useSharedValue(0);
  useEffect(() => {
    beamOpacity.value = withTiming(processing ? 0.85 : 0, { duration: 220 });
    if (processing) {
      sweep.value = 0;
      sweep.value = withRepeat(
        withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      );
    } else {
      sweep.value = 0;
    }
  }, [beamOpacity, processing, sweep]);

  // dB → 0–1 mapping happens at the source; here just clamp defensively.
  const t = useDerivedValue(() => Math.min(1, Math.max(0, level.value)));

  const beamX = useDerivedValue(() => {
    return PAD - BEAM_WIDTH / 2 + (size.width + BEAM_WIDTH) * sweep.value;
  }, [size.width]);

  return (
    <View
      className={className}
      onLayout={onLayout}
    >
      {Platform.OS === 'web' ? null : (
        <Canvas
          pointerEvents='none'
          style={[
            StyleSheet.absoluteFillObject,
            { left: -PAD, right: -PAD, top: -PAD, bottom: -PAD },
          ]}
        >
          {/* Wide outer halo */}
          <Group opacity={useDerivedValue(() => 0.14 + t.value * 0.34)}>
            <BlurMask
              blur={useDerivedValue(() => 12 + 20 * t.value)}
              style='normal'
            />
            <RoundedRect
              x={PAD}
              y={PAD}
              width={size.width}
              height={size.height}
              r={borderRadius}
              color={colors.outer}
              style='stroke'
              strokeWidth={useDerivedValue(() => 3 + 10 * t.value)}
            />
          </Group>

          {/* Middle lobe */}
          <Group opacity={useDerivedValue(() => 0.2 + t.value * 0.5)}>
            <BlurMask
              blur={useDerivedValue(() => 7 + 11 * t.value)}
              style='normal'
            />
            <RoundedRect
              x={PAD}
              y={PAD}
              width={size.width}
              height={size.height}
              r={borderRadius}
              color={colors.mid}
              style='stroke'
              strokeWidth={useDerivedValue(() => 2.5 + 5 * t.value)}
            />
          </Group>

          {/* Core hairline */}
          <Group opacity={useDerivedValue(() => 0.3 + t.value * 0.6)}>
            <BlurMask
              blur={useDerivedValue(() => 2 + 4 * t.value)}
              style='normal'
            />
            <RoundedRect
              x={PAD}
              y={PAD}
              width={size.width}
              height={size.height}
              r={borderRadius}
              color={colors.core}
              style='stroke'
              strokeWidth={2}
            />
          </Group>

          {/* Transcription beam riding the bottom edge */}
          <Group opacity={beamOpacity}>
            <BlurMask
              blur={14}
              style='normal'
            />
            <RoundedRect
              x={beamX}
              y={PAD + size.height - 7}
              width={BEAM_WIDTH}
              height={7}
              r={3.5}
              color={colors.core}
            />
          </Group>
        </Canvas>
      )}
      {children}
    </View>
  );
}
