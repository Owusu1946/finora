import {
  BlurMask,
  Rect,
  Canvas,
  Group,
  Oval,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Bump the lobe gain on dark themes: additive blending plus a higher base
 * opacity matches the reference's peak luminance, where overlapping color
 * washes visibly stack. Light themes stay on normal blending (plus would
 * saturate the white background) at a slightly boosted opacity.
 */
const LOBE_GAIN_DARK = 0.95;
const LOBE_GAIN_LIGHT = 0.8;

export type VoiceBloomPalette = {
  /** Bright core hugging the bottom edge */
  core: string;
  /** One color per lobe, centre first (7 entries cycle through) */
  lobes: string[];
};

type VoiceScreenBloomProps = {
  /** Smoothed mic level 0–1 */
  level: SharedValue<number>;
  /** True while transcription runs: lobes gather into a sweeping band */
  processing: boolean;
  /** How far the canvas must extend past the composer to reach the screen edge */
  bottomBleed: number;
  colors: VoiceBloomPalette;
  /** Dark themes: lobes blend additively so overlapping washes stack */
  additive?: boolean;
};

/**
 * Geometry ported from Libraries.dev's VoiceBeam 'mobile' type: seven soft
 * ellipses anchored at the bottom edge, px for a ~350px reference element,
 * each following one of three frequency bands (chest / vowels / sibilance).
 * The centre lobe rides the low band, its neighbours the mids, the outer
 * pair the highs and the far pair the mids again, so a voice ripples the
 * colours outward instead of one blob pumping.
 */
const REF_WIDTH = 350;
const LOBE_DEFS = [
  { x: 0, w: 74, h: 46, band: 0 },
  { x: -36, w: 54, h: 40, band: 1 },
  { x: 36, w: 54, h: 40, band: 1 },
  { x: -72, w: 48, h: 32, band: 2 },
  { x: 72, w: 48, h: 32, band: 2 },
  { x: -108, w: 42, h: 26, band: 1 },
  { x: 108, w: 42, h: 26, band: 1 },
] as const;

/** Mobile-type preset multipliers from the reference (presets.ts). */
const MOBILE = {
  scale: 1.25,
  glowWidth: 1.15,
  glowHeight: 2.1,
  flowPxs: 60,
};
const BLOOM_HEIGHT = 280;
/** Band dynamics ported from voiceDriver.ts: fast attack, slow release. */
const FOLLOW_ATTACK = 0.325;
const FOLLOW_RELEASE = 0.86;
const BAND_GAINS: readonly number[] = [0.95, 0.8, 0.65];

const clamp01 = (v: number) => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

/** One-pole follower: fast up, slow down — the voice envelope's spine. */
const follow = (prev: number, target: number, dt: number) => {
  'worklet';
  const tau = target > prev ? FOLLOW_ATTACK : FOLLOW_RELEASE;
  const a = 1 - Math.exp(-dt / tau);
  return prev + (target - prev) * a;
};

/** Wrap a lobe offset into [-span/2, span/2) so lobes cycle through centre. */
const wrapX = (x: number, span: number) => {
  'worklet';
  const half = span / 2;
  return ((((x + half) % span) + span) % span) - half;
};

/** Full at centre, gone at the wrap edge, so a lobe never pops sides. */
const edgeEnvelope = (x: number, span: number) => {
  'worklet';
  const t = x / (span / 2 + 4);
  return Math.max(0, 1 - t * t);
};

/**
 * The 'mobile' voice glow: a full-width bloom anchored to the bottom screen
 * edge. Seven colour lobes rise with the voice bands and drift sideways with
 * the flow; while transcription runs they gather into one band that sweeps
 * side to side. Overlays the composer and the bottom of the message list;
 * pointer-events disabled.
 */
export function VoiceScreenBloom({
  level,
  processing,
  bottomBleed,
  colors,
  additive = false,
}: VoiceScreenBloomProps) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(BLOOM_HEIGHT + bottomBleed);
  useLayoutEffect(() => setHeight(BLOOM_HEIGHT + bottomBleed), [bottomBleed]);

  // Visible content edge: the glow line sits just above the safe-area bleed
  // so it shows on screen while spilling into the inset below.
  const edgeY = height - bottomBleed + 6;

  const processingRef = useSharedValue(processing);
  useEffect(() => {
    processingRef.value = processing;
  }, [processing, processingRef]);

  // Drive state on the UI thread: flow drift, per-band followers, and the
  // processing gather. One frame callback, no JS round-trips.
  const flow = useSharedValue(0);
  const clock = useSharedValue(0);
  const band0 = useSharedValue(0);
  const band1 = useSharedValue(0);
  const band2 = useSharedValue(0);
  const gather = useSharedValue(0);
  useFrameCallback((info) => {
    // Frame times can arrive in mixed units across surfaces, so normalise
    // defensively.
    const raw = info.timeSincePreviousFrame ?? 0.016;
    const dt = Math.min(0.05, Math.max(0.001, raw > 0.5 ? raw : raw / 1000));
    flow.value += MOBILE.flowPxs * dt;
    clock.value += dt;
    const t = clamp01(level.value);
    band0.value = follow(band0.value, t * BAND_GAINS[0], dt);
    band1.value = follow(band1.value, t * BAND_GAINS[1], dt);
    band2.value = follow(band2.value, t * BAND_GAINS[2], dt);
    const target = processingRef.value ? 1 : 0;
    const tau = target > gather.value ? 0.16 : 0.5;
    gather.value += (target - gather.value) * (1 - Math.exp(-dt / tau));
  }, true);

  // The sweep position for the gathered beam, 0→1→0 side to side.
  const sweepPhase = useDerivedValue(() => {
    'worklet';
    return 0.5 - 0.5 * Math.cos(clock.value * Math.PI);
  });

  if (Platform.OS === 'web' || width === 0) {
    return (
      <View
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next !== width) setWidth(next);
        }}
        pointerEvents='none'
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <View
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) setWidth(next);
      }}
      pointerEvents='none'
      style={StyleSheet.absoluteFill}
    >
      <Canvas
        pointerEvents='none'
        style={{ position: 'absolute', left: -12, right: -12, bottom: -bottomBleed, height }}
      >
        <BloomLobes
          band0={band0}
          band1={band1}
          band2={band2}
          clock={clock}
          colors={colors.lobes}
          flow={flow}
          gather={gather}
          width={width}
          bottomY={edgeY}
          additive={additive}
        />

        {/* Core along the bottom edge, brightest behind the composer row */}
        <BloomCore
          color={colors.core}
          band0={band0}
          width={width}
          bottomY={edgeY}
        />

        {/* Gathered transcription sweep */}
        <BloomSweep
          color={colors.core}
          gather={gather}
          sweepPhase={sweepPhase}
          width={width}
          bottomY={edgeY}
        />
      </Canvas>
    </View>
  );
}

function BloomLobes({
  band0,
  band1,
  band2,
  clock,
  colors,
  flow,
  gather,
  width,
  bottomY,
  additive,
}: {
  band0: SharedValue<number>;
  band1: SharedValue<number>;
  band2: SharedValue<number>;
  clock: SharedValue<number>;
  colors: string[];
  flow: SharedValue<number>;
  gather: SharedValue<number>;
  width: number;
  bottomY: number;
  additive: boolean;
}) {
  const scale = (width / REF_WIDTH) * MOBILE.scale;

  return (
    <Group>
      {LOBE_DEFS.map((lobe, index) => (
        <BloomLobe
          key={`${lobe.x}-${index}`}
          bandValue={lobe.band === 0 ? band0 : lobe.band === 1 ? band1 : band2}
          clock={clock}
          color={colors[index % colors.length]}
          restX={lobe.x * 1.35 * scale}
          span={36 * LOBE_DEFS.length * 1.35 * scale}
          flowValue={flow}
          gather={gather}
          glowH={lobe.h * MOBILE.glowHeight * scale}
          glowW={lobe.w * MOBILE.glowWidth * scale}
          index={index}
          width={width}
          bottomY={bottomY}
          additive={additive}
        />
      ))}
    </Group>
  );
}

/** One soft ellipse: radial gradient fill (no blur mask), driven per frame. */
function BloomLobe({
  bandValue,
  clock,
  color,
  restX,
  span,
  flowValue,
  gather,
  glowH,
  glowW,
  index,
  width,
  bottomY,
  additive,
}: {
  bandValue: SharedValue<number>;
  clock: SharedValue<number>;
  color: string;
  restX: number;
  span: number;
  flowValue: SharedValue<number>;
  gather: SharedValue<number>;
  glowH: number;
  glowW: number;
  index: number;
  width: number;
  bottomY: number;
  additive: boolean;
}) {
  const opacity = useDerivedValue(() => {
    'worklet';
    // Slight per-lobe shimmer so the seven don't move in lockstep.
    const shimmer = 0.85 + 0.15 * Math.sin(clock.value * 2.1 + index * 1.9);
    const env = edgeEnvelope(wrapX(restX + flowValue.value, span), span);
    // While processing, lobes hand the stage to the gathered beam.
    const gain = additive ? LOBE_GAIN_DARK : LOBE_GAIN_LIGHT;
    return clamp01(gain * env * shimmer * bandValue.value * (1 - 0.55 * gather.value));
  });
  const w = useDerivedValue(() => {
    'worklet';
    return glowW * (1 + 0.22 * bandValue.value);
  });
  const h = useDerivedValue(() => {
    'worklet';
    const lift = glowH * 0.6 * bandValue.value;
    return Math.max(glowH * 0.4, glowH * 0.42 + lift);
  });
  const x = useDerivedValue(() => {
    'worklet';
    const drift = wrapX(restX + flowValue.value, span);
    // Processing gathers the lobes toward the sweeping band's centre.
    return width / 2 + drift * (1 - gather.value) - w.value / 2;
  });
  const y = useDerivedValue(() => {
    'worklet';
    const rise = glowH * 0.3 * bandValue.value;
    return bottomY - h.value * 0.5 - rise;
  });

  return (
    <Group
      opacity={opacity}
      blendMode={additive ? 'plus' : undefined}
    >
      <BlurMask
        blur={glowW * 0.32}
        style='normal'
      />
      <Oval
        x={x}
        y={y}
        width={w}
        height={h}
        color={color}
      />
    </Group>
  );
}

function BloomCore({
  color,
  band0,
  width,
  bottomY,
}: {
  color: string;
  band0: SharedValue<number>;
  width: number;
  bottomY: number;
}) {
  const coreH = 34;
  const r = Math.max(140, width * 0.42);
  const opacity = useDerivedValue(() => {
    'worklet';
    return 0.22 + clamp01(band0.value) * 0.78;
  });
  return (
    <Group opacity={opacity}>
      {/* Hot centre hugging the edge, like the reference. Painted as a bare
          wash: a shaped rect (however rounded) clips the radial gradient into
          a perceivable pill. The gradient itself must also carry the shape,
          so the surface extends well past the gradient radius and the shader
          inside the shape gets a real SkPoint via vec() (a plain {x,y} or an
          outer <Paint> silently drops the shader → Skia's default black). */}
      <Rect
        x={0}
        y={bottomY - r * 2}
        width={width}
        height={r * 2 + coreH}
      >
        <RadialGradient
          c={vec(width / 2, bottomY)}
          r={r}
          colors={[color, `${color}00`]}
          positions={[0, 0.38]}
        />
      </Rect>
    </Group>
  );
}

function BloomSweep({
  color,
  gather,
  sweepPhase,
  width,
  bottomY,
}: {
  color: string;
  gather: SharedValue<number>;
  sweepPhase: SharedValue<number>;
  width: number;
  bottomY: number;
}) {
  const beamW = width * 0.38;
  const opacity = useDerivedValue(() => {
    'worklet';
    return gather.value * 0.85;
  });
  const x = useDerivedValue(() => {
    'worklet';
    const range = width + beamW;
    return range * sweepPhase.value - beamW / 2;
  });
  return (
    <Group opacity={opacity}>
      <BlurMask
        blur={beamW * 0.42}
        style='normal'
      />
      <Rect
        x={x}
        y={bottomY - 26}
        width={beamW}
        height={30}
        color={color}
      />
    </Group>
  );
}
