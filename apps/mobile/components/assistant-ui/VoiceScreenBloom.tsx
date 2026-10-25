import { BlurMask, Canvas, Circle, Group, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type VoiceBloomPalette = {
  /** Bright core hugging the bottom edge */
  core: string;
  /** Large soft lobes fanning up from the bottom of the screen */
  lobes: string[];
};

type VoiceScreenBloomProps = {
  /** Smoothed mic level 0–1 */
  level: SharedValue<number>;
  /** True while transcription runs: sweeps a band along the bottom edge */
  processing: boolean;
  /** How far the canvas must extend past the composer to reach the screen edge */
  bottomBleed: number;
  colors: VoiceBloomPalette;
};

const BLOOM_HEIGHT = 300;

// Horizontal spread of the lobes (fractions of canvas width). Staggered
// strengths so they surface one after another as the level climbs.
const LOBES = [
  { frac: 0.14, strength: 0.55, radius: 130 },
  { frac: 0.42, strength: 0.8, radius: 155 },
  { frac: 0.68, strength: 0.7, radius: 148 },
  { frac: 0.9, strength: 0.55, radius: 130 },
];

/**
 * The "mobile" voice geometry: a full-width bloom anchored to the bottom
 * screen edge, color lobes rising with the mic level, plus a side-to-side
 * sweep band while transcription is under way. Overlays the composer and the
 * bottom of the message list; pointer-events disabled.
 */
export function VoiceScreenBloom({
  level,
  processing,
  bottomBleed,
  colors,
}: VoiceScreenBloomProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next !== width) setWidth(next);
  };

  const processingRef = useSharedValue(processing);
  useEffect(() => {
    processingRef.value = processing;
  }, [processing, processingRef]);

  // Processing holds a steady work-while-thinking level; recording is reactive.
  const activeLevel = useDerivedValue(() => {
    if (processingRef.value) return 0.4;
    return Math.min(1, Math.max(0, level.value));
  });

  // Side-to-side sweep band while processing.
  const sweep = useSharedValue(0);
  const beamOpacity = useSharedValue(0);
  useEffect(() => {
    beamOpacity.value = withTiming(processing ? 0.65 : 0, { duration: 220 });
    if (processing) {
      sweep.value = withRepeat(
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      sweep.value = 0;
    }
  }, [beamOpacity, processing, sweep]);

  if (Platform.OS === 'web' || width === 0) {
    return (
      <View
        pointerEvents='none'
        onLayout={onLayout}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  const height = BLOOM_HEIGHT + bottomBleed;
  const bottomY = height - 2;
  const maxCoreHeight = 34;
  const beamWidth = width * 0.34;

  return (
    <View
      onLayout={onLayout}
      pointerEvents='none'
      style={StyleSheet.absoluteFill}
    >
      <Canvas
        pointerEvents='none'
        style={{ position: 'absolute', left: -12, right: -12, bottom: -bottomBleed, height }}
      >
        {/* Corner-fanning color lobes, rising with level */}
        {LOBES.map((lobe, index) => (
          <BloomLobe
            key={lobe.frac}
            activeLevel={activeLevel}
            bottomY={bottomY}
            color={colors.lobes[index % colors.lobes.length]}
            frac={lobe.frac}
            index={index}
            radius={lobe.radius}
            strength={lobe.strength}
            width={width}
          />
        ))}

        {/* Core along the bottom edge, brightest behind the composer row */}
        <Group
          opacity={useDerivedValue(() => {
            return 0.22 + activeLevel.value * 0.78;
          })}
        >
          <BlurMask
            blur={16}
            style='normal'
          />
          <RoundedRect
            x={0}
            y={useDerivedValue(() => {
              return bottomY - (8 + 26 * activeLevel.value);
            })}
            width={width}
            height={maxCoreHeight}
            r={maxCoreHeight / 2}
            color={colors.core}
          />
        </Group>

        {/* Transcription sweep */}
        <Group opacity={beamOpacity}>
          <BlurMask
            blur={20}
            style='normal'
          />
          <RoundedRect
            x={useDerivedValue(() => {
              return -beamWidth / 2 + (width + beamWidth) * sweep.value;
            })}
            y={bottomY - 20}
            width={beamWidth}
            height={18}
            r={9}
            color={colors.core}
          />
        </Group>
      </Canvas>
    </View>
  );
}

function BloomLobe({
  activeLevel,
  bottomY,
  color,
  frac,
  index,
  radius,
  strength,
  width,
}: {
  activeLevel: SharedValue<number>;
  bottomY: number;
  color: string;
  frac: number;
  index: number;
  radius: number;
  strength: number;
  width: number;
}) {
  const opacity = useDerivedValue(() => {
    const surface = interpolate(activeLevel.value, [0, 0.25, 0.55, 0.9], [0, 0.35, 0.7, 1]);
    return strength * 0.62 * surface;
  });
  const cy = useDerivedValue(() => {
    const rise = activeLevel.value * (34 + (index % 2) * 26);
    return bottomY - 34 - rise;
  });
  const r = useDerivedValue(() => {
    return radius * (0.35 + 0.65 * activeLevel.value);
  });

  return (
    <Group opacity={opacity}>
      <BlurMask
        blur={44 + index * 6}
        style='normal'
      />
      <Circle
        cx={frac * width}
        cy={cy}
        r={r}
        color={color}
      />
    </Group>
  );
}
