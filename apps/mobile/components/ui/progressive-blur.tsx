import {
  BackdropFilter,
  Canvas,
  Fill,
  LinearGradient,
  RuntimeShader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Edge-fading blur, drawn from the live backdrop behind the canvas.
 *
 * Unlike stacked BlurViews or hard-clipped backdrop filters, this computes the
 * blur radius per pixel inside a single shader, so the profile is continuous
 * and reaches exactly zero blur at the far edge — no seams, no banding.
 */

/* ------------------------------------------------------------------ */
/* Tap table                                                           */
/* ------------------------------------------------------------------ */

// One axis of a gaussian approximated by symmetric sample pairs. Samples sit
// at the midpoints of equal-mass segments of the half-gaussian on
// [0, GAUSSIAN_REACH] sigma, so equal weights are the correct quadrature —
// the classic cheap-gaussian design (same shape as native blur taps).
const TAP_PAIRS = 7;
const GAUSSIAN_REACH = 2.5;

// Inverse standard normal CDF (Acklam's rational approximation, ~1e-9).
function normalInvCdf(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('normalInvCdf: p out of range');
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.40075727796884, -2.549732529342177,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661847293];
  const pLow = 0.02425;
  if (p < pLow || p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(p < pLow ? p : 1 - p));
    return (
      ((((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)) *
      (p < pLow ? 1 : -1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (erf approx, |err| < 1.5e-7).
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061399848 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

// Segment widths are equal (uniform over [0.5, Φ(2.5)] in probability space);
// midpoints in sigma units land where the gaussian CDF crosses each segment's
// middle. Φ(2.5) ≈ 0.9938, so every midpoint argument stays inside (0, 1).
const SEGMENT_MASS = (normalCdf(GAUSSIAN_REACH) - 0.5) / TAP_PAIRS;
const TAPS = Array.from({ length: TAP_PAIRS }, (_, i) =>
  normalInvCdf(0.5 + SEGMENT_MASS * (i + 0.5)),
);
const TAP_WEIGHT = 1 / (2 * TAP_PAIRS + 1);

/* ------------------------------------------------------------------ */
/* Shader sources                                                      */
/* ------------------------------------------------------------------ */

/**
 * Variable sigma along one axis, falloff = 1 - smoothstep(t) then ^1.5:
 * flat near the edge (the blur saturates, like native materials), and both
 * the value and slope reach exactly zero at the reach distance, so the
 * passthrough branch below is C1-continuous with the blurred region.
 */
function makeAxisShader(axis: 'x' | 'y'): string {
  const dir = axis === 'x' ? 'float2(1.0, 0.0)' : 'float2(0.0, 1.0)';
  const taps = TAPS.map(
    (o) => `acc += child.eval(p + ${dir} * (${o.toFixed(6)} * s)) * ${TAP_WEIGHT.toFixed(7)};`,
  ).join('\n');
  return `uniform shader child;
uniform float uMax;      // sigma in px at the very edge
uniform float uSpan;     // distance from the edge at which blur reaches zero
uniform float uFlip;     // 1.0: strongest at y=0 (top edge); -1.0: at y=uHeight
uniform float uHeight;   // region height in px

half4 main(float2 p) {
  float d = uFlip > 0.0 ? p.y : (uHeight - p.y);
  float s = uMax * pow(1.0 - smoothstep(0.0, 1.0, clamp(d / uSpan, 0.0, 1.0)), 1.5);
  if (s < 0.05) {
    return child.eval(p);
  }
  half4 acc = half4(0.0);
${taps}
  return acc;
}`;
}

// Inner pass blurs horizontally first; the outer pass then blurs vertically.
// The empty child-shader name binds the previous filter's output (Skia auto-
// binds a single child when the chain ends with no explicit name).
function effectFor(source: string) {
  try {
    return Skia.RuntimeEffect.Make(source);
  } catch (error) {
    console.error('[progressive-blur] shader compile failed:', error);
    return null;
  }
}

const HorizontalEffect = effectFor(makeAxisShader('x'));
const VerticalEffect = effectFor(makeAxisShader('y'));

/* ------------------------------------------------------------------ */
/* Color helper                                                        */
/* ------------------------------------------------------------------ */

/** '#RRGGBB' or '#RRGGBBAA' -> 'rgba(r, g, b, a)'. */
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */

type ProgressiveBlurProps = {
  side: 'top' | 'bottom';
  /** Region height in px; corrected automatically once measured on layout. */
  height: number;
  /** Peak sigma in px at the edge. Default 16. */
  maxIntensity?: number;
  /** Distance from the edge at which blur hits zero. Default = height. */
  reach?: number;
  /** Optional hex scrim color over the region, fading like the blur does. */
  tint?: string;
  /** Scrim alpha at the very edge, 0-1. Use with `tint`. */
  tintStrength?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressiveBlur({
  height,
  maxIntensity = 16,
  reach,
  side,
  style,
  tint,
  tintStrength = 0,
}: ProgressiveBlurProps) {
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const h = measuredHeight ?? height;
  const span = reach ?? h;

  // Devices that cannot compile the runtime effect fall back to a plain
  // tinted surface instead of an unreadable transparent header.
  if (!HorizontalEffect || !VerticalEffect) {
    return (
      <View
        pointerEvents='none'
        style={[style, { backgroundColor: tint ?? 'transparent', height: h }]}
      />
    );
  }

  return (
    <View
      onLayout={(event: { nativeEvent: { layout: { height: number } } }) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        if (next > 0 && next !== measuredHeight) setMeasuredHeight(next);
      }}
      pointerEvents='none'
      style={[style, { height: h }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <BackdropFilter
          filter={
            <RuntimeShader
              source={VerticalEffect}
              uniforms={{
                uMax: maxIntensity,
                uSpan: span,
                uFlip: side === 'top' ? 1 : -1,
                uHeight: h,
              }}
            >
              <RuntimeShader
                source={HorizontalEffect}
                uniforms={{
                  uMax: maxIntensity,
                  uSpan: span,
                  uFlip: side === 'top' ? 1 : -1,
                  uHeight: h,
                }}
              />
            </RuntimeShader>
          }
        >
          {tint && tintStrength > 0 ? (
            <Fill>
              <LinearGradient
                colors={[withAlpha(tint, tintStrength), withAlpha(tint, 0)]}
                end={vec(0, side === 'top' ? h : 0)}
                positions={[0, 1]}
                start={vec(0, side === 'top' ? 0 : h)}
              />
            </Fill>
          ) : null}
        </BackdropFilter>
      </Canvas>
    </View>
  );
}
