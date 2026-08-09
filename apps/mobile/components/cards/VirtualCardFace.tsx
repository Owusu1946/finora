import { AppText as Text } from '@/components/ui/text';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient as SkiaLinearGradient,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const FLIP_MS = 580;
const FLIP_EASING = Easing.bezier(0.22, 1, 0.36, 1);

import { MastercardLogo, VisaLogo } from '@/components/cards/network-logos';
import { formatPanGrouped, type VirtualCard } from '@/components/cards/types';
import { FinoraMark } from '@/components/ui/finora-mark';
import { Rounded } from '@/constants/theme';
import { useCardTilt } from '@/hooks/use-card-tilt';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';

type VirtualCardFaceProps = {
  card: VirtualCard;
  compact?: boolean;
  onPress?: () => void;
  /** Soft entrance after issue */
  appear?: boolean;
  /** Device-tilt metal gloss (off for tiny list thumbs). */
  tilt?: boolean;
  /** Full PAN and expiry are rendered only after passcode approval. */
  revealed?: boolean;
  /** Front or secure CVV side. */
  side?: 'front' | 'back';
  /** Called after a deliberate wrist-turn gesture. */
  onFlipGesture?: () => void;
};

const CARD_RADIUS = 22;

function ContactlessMark({ compact }: { compact?: boolean }) {
  const size = compact ? 22 : 30;
  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
    >
      {[
        'M8.5 12.8C10.5 14.6 10.5 17.4 8.5 19.2',
        'M12.5 9.8C16 13.1 16 18.9 12.5 22.2',
        'M16.5 6.8C21.7 11.8 21.7 20.2 16.5 25.2',
        'M20.5 3.8C27.4 10.5 27.4 21.5 20.5 28.2',
      ].map((d) => (
        <Path
          key={d}
          d={d}
          fill='none'
          stroke='#c3c8c6'
          strokeWidth='2'
          strokeLinecap='round'
        />
      ))}
    </Svg>
  );
}

function EMVChip({ compact }: { compact?: boolean }) {
  const width = compact ? 42 : 56;
  const height = compact ? 31 : 42;
  return (
    <View style={[styles.chipShell, { width, height }]}>
      <Svg
        width='100%'
        height='100%'
        viewBox='0 0 120 90'
      >
        <Defs>
          <SvgLinearGradient
            id='chipMetal'
            x1='0'
            y1='0'
            x2='1'
            y2='1'
          >
            <Stop
              offset='0'
              stopColor='#e2e4e3'
            />
            <Stop
              offset='36%'
              stopColor='#8d9390'
            />
            <Stop
              offset='70%'
              stopColor='#d0d4d2'
            />
            <Stop
              offset='1'
              stopColor='#666c69'
            />
          </SvgLinearGradient>
        </Defs>
        <Rect
          width='120'
          height='90'
          rx='12'
          fill='url(#chipMetal)'
        />
        <G
          fill='none'
          stroke='#5d6360'
          strokeWidth='2'
          opacity='.84'
        >
          <Path d='M42 0v90M78 0v90M0 30h120M0 60h120M42 30h36v30H42zM0 15h42M78 15h42M0 75h42M78 75h42' />
        </G>
        <Rect
          x='42'
          y='30'
          width='36'
          height='30'
          rx='3'
          fill='#a4a9a7'
          opacity='.5'
        />
      </Svg>
    </View>
  );
}

function NetworkMark({
  network,
  compact,
}: {
  network: VirtualCard['network'];
  compact?: boolean;
}) {
  if (network === 'visa') {
    return (
      <VisaLogo
        width={compact ? 42 : 54}
      />
    );
  }
  return (
    <MastercardLogo
      width={compact ? 34 : 44}
    />
  );
}

/**
 * Emerald particle ribbon from the Finora card art (not stroked paths):
 * a dense cloud of tiny dots along overlapping S-curves —
 * starts mid-left under the chip, dips, then flares up into the top-right.
 */
function IntelligenceWave({
  width,
  height,
  compact,
}: {
  width: number;
  height: number;
  compact?: boolean;
}) {
  const layers = useMemo(() => {
    if (width < 8 || height < 8) {
      return { core: '', mid: '', mist: '' };
    }

    const strandCount = compact ? 48 : 96;
    const samplesPerStrand = compact ? 70 : 130;
    const core: string[] = [];
    const mid: string[] = [];
    const mist: string[] = [];

    for (let s = 0; s < strandCount; s++) {
      const sn = (s + 0.5) / strandCount;
      const spine = Math.exp(-Math.pow((sn - 0.5) / 0.26, 2));
      const phase = (sn - 0.5) * Math.PI * 2.4;

      for (let i = 0; i < samplesPerStrand; i++) {
        const t = i / (samplesPerStrand - 1);

        // Centerline: under chip → slight dip → rise into top-right
        const x = width * (0.1 + t * 0.95);
        const yCenter =
          height *
          (0.54 +
            Math.sin(t * Math.PI * 1.15) * 0.11 -
            Math.pow(t, 1.55) * 0.42 +
            Math.sin(t * Math.PI * 2.8 + phase) * 0.012);

        // Narrow left → fans out on the right
        const spread = height * (0.018 + Math.pow(t, 1.1) * 0.165);
        const lateral = (sn - 0.5) * 2 * spread;
        const flow = 0.35 + 0.65 * Math.exp(-Math.pow((t - 0.68) / 0.42, 2));
        const enter = Math.min(1, t * 4.2);

        if (spine < 0.16 && (i + s * 3) % 4 !== 0) continue;
        if (spine < 0.38 && flow < 0.45 && (i + s) % 2 === 0) continue;
        if (t < 0.07 && spine < 0.55) continue;

        const jx = Math.sin(s * 17.3 + i * 4.1) * (0.25 + (1 - spine) * 1.15);
        const jy = Math.cos(s * 11.9 + i * 3.3) * (0.2 + (1 - spine) * 1.3);
        const cx = x + lateral * 0.12 + jx;
        const cy = yCenter + lateral + jy;
        const r = (compact ? 0.5 : 0.62) + spine * 0.65 * flow + (t > 0.55 ? 0.22 : 0);
        const brightness = spine * flow * enter;
        const circle = `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(
          r * 2
        ).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-r * 2).toFixed(2)} 0`;

        if (brightness > 0.58) core.push(circle);
        else if (brightness > 0.28) mid.push(circle);
        else mist.push(circle);
      }
    }

    return {
      core: core.join(''),
      mid: mid.join(''),
      mist: mist.join(''),
    };
  }, [compact, height, width]);

  if (width < 8 || height < 8) return null;

  return (
    <Svg
      pointerEvents='none'
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      {layers.mist ? (
        <Path
          d={layers.mist}
          fill='#8affee'
          opacity={0.04}
        />
      ) : null}
      {layers.mid ? (
        <Path
          d={layers.mid}
          fill='#9dffd8'
          opacity={0.06}
        />
      ) : null}
      {layers.core ? (
        <Path
          d={layers.core}
          fill='#c4ffe8'
          opacity={0.08}
        />
      ) : null}
    </Svg>
  );
}

function MetalGlossSurface({
  width,
  height,
  tiltX,
  tiltY,
  muted,
}: {
  width: number;
  height: number;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  muted?: boolean;
}) {
  const glareCenter = useDerivedValue(() => {
    const x = width * (0.32 + tiltY.value * 0.5);
    const y = height * (0.22 - tiltX.value * 0.48);
    return vec(x, y);
  });

  const bandStart = useDerivedValue(() => {
    const x = width * (-0.45 + tiltY.value * 0.72);
    const y = height * (-0.45 - tiltX.value * 0.5);
    return vec(x, y);
  });

  const bandEnd = useDerivedValue(() => {
    const x = width * (0.75 + tiltY.value * 0.72);
    const y = height * (1.3 - tiltX.value * 0.5);
    return vec(x, y);
  });

  if (width < 8 || height < 8) return null;

  const glareRadius = Math.max(width, height) * 0.42;

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={CARD_RADIUS}
      >
        <SkiaLinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={['#303238', '#151619', '#030304', '#1c1e23']}
          positions={[0, 0.28, 0.7, 1]}
        />
      </RoundedRect>

      {/* Whisper of mint atmosphere under the particle field. */}
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={CARD_RADIUS}
        opacity={muted ? 0.03 : 0.06}
      >
        <SkiaLinearGradient
          start={vec(0, height * 0.92)}
          end={vec(width, height * 0.12)}
          colors={[
            'rgba(160,255,220,0)',
            'rgba(160,255,220,0.008)',
            'rgba(160,255,220,0.016)',
            'rgba(160,255,220,0)',
          ]}
          positions={[0, 0.34, 0.72, 1]}
        />
      </RoundedRect>

      {/* Soft ambient metal sheen */}
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={CARD_RADIUS}
        opacity={muted ? 0.16 : 0.34}
      >
        <SkiaLinearGradient
          start={bandStart}
          end={bandEnd}
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.01)',
            'rgba(235,242,255,0.16)',
            'rgba(255,255,255,0.045)',
            'rgba(255,255,255,0)',
          ]}
          positions={[0, 0.36, 0.49, 0.58, 1]}
        />
      </RoundedRect>

      {/* Specular hotspot that tracks tilt — Apple Cash gloss */}
      <Group opacity={muted ? 0.08 : 0.24}>
        <RoundedRect
          x={0}
          y={0}
          width={width}
          height={height}
          r={CARD_RADIUS}
        >
          <RadialGradient
            c={glareCenter}
            r={glareRadius}
            colors={[
              'rgba(255,255,255,0.34)',
              'rgba(225,235,255,0.12)',
              'rgba(255,255,255,0.025)',
              'rgba(255,255,255,0)',
            ]}
            positions={[0, 0.2, 0.52, 1]}
          />
          <BlurMask
            blur={15}
            style='normal'
          />
        </RoundedRect>
      </Group>

      {/* Top edge catch-light */}
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height * 0.22}
        r={CARD_RADIUS}
        opacity={0.34}
      >
        <SkiaLinearGradient
          start={vec(0, 0)}
          end={vec(0, height * 0.22)}
          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.025)', 'rgba(255,255,255,0)']}
          positions={[0, 0.25, 1]}
        />
      </RoundedRect>
    </Canvas>
  );
}

export function VirtualCardFace({
  card,
  compact,
  onPress,
  appear,
  tilt,
  revealed,
  side = 'front',
  onFlipGesture,
}: VirtualCardFaceProps) {
  const frozen = card.status === 'frozen';
  const cancelled = card.status === 'cancelled';
  const { settings } = useSettings();
  const cardholder = settings.displayName.trim().toUpperCase() || 'FINORA MEMBER';
  const tiltEnabled = tilt ?? !compact;
  const { tiltX, tiltY } = useCardTilt(tiltEnabled, onFlipGesture);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scale = useSharedValue(appear ? 0.96 : 1);
  const opacity = useSharedValue(appear ? 0 : 1);
  const flipProgress = useSharedValue(side === 'back' ? 1 : 0);

  useEffect(() => {
    if (!appear) return;
    scale.value = withTiming(1, { duration: 320 });
    opacity.value = withTiming(1, { duration: 320 });
  }, [appear, opacity, scale]);

  useEffect(() => {
    flipProgress.value = withTiming(side === 'back' ? 1 : 0, {
      duration: FLIP_MS,
      easing: FLIP_EASING,
    });
  }, [flipProgress, side]);

  // Outer tilt parks mid-flip so it never fights the card spin.
  const animatedStyle = useAnimatedStyle(() => {
    const tiltMix = interpolate(flipProgress.value, [0, 0.12, 0.88, 1], [1, 0, 0, 1]);
    const depth = interpolate(flipProgress.value, [0, 0.5, 1], [1, 0.96, 1]);
    return {
      opacity: opacity.value,
      transform: [
        { perspective: 1200 },
        { rotateX: `${tiltX.value * (compact ? 2 : 3.2) * tiltMix}deg` },
        { rotateY: `${tiltY.value * (compact ? 2.5 : 4) * tiltMix}deg` },
        { scale: scale.value * depth * (1 - Math.abs(tiltX.value) * 0.01 * tiltMix) },
      ],
    };
  });

  // 0→90° (hide front), swap faces, −90°→0° (reveal back upright).
  // Avoids RN blank back-faces from nested rotateY + backfaceVisibility.
  const deckStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 0])}deg`,
      },
    ],
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
    zIndex: flipProgress.value < 0.5 ? 2 : 0,
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
    zIndex: flipProgress.value >= 0.5 ? 2 : 0,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const padStyle = compact ? styles.faceCompact : styles.faceHero;

  const content = (
    <Animated.View
      style={[
        styles.shadowWrap,
        compact ? styles.shadowCompact : styles.shadowHero,
        animatedStyle,
      ]}
    >
      <View
        onLayout={onLayout}
        style={[
          styles.shell,
          compact ? styles.shellCompact : styles.shellHero,
          (frozen || cancelled) && styles.desaturated,
        ]}
      >
        <Animated.View style={[styles.flipDeck, deckStyle]}>
          <Animated.View
            pointerEvents={side === 'front' ? 'auto' : 'none'}
            style={[styles.faceSide, padStyle, frontFaceStyle]}
          >
            {side === 'front' || size.width > 0 ? (
              <>
                <MetalGlossSurface
                  width={size.width}
                  height={size.height}
                  tiltX={tiltX}
                  tiltY={tiltY}
                  muted={frozen || cancelled}
                />
                <IntelligenceWave
                  width={size.width}
                  height={size.height}
                  compact={compact}
                />
              </>
            ) : null}

            <View style={styles.topRow}>
              <View style={styles.brandBlock}>
                <FinoraMark
                  variant='bare'
                tone='dark'
                  compact={compact}
                />
                <View>
                  <Text style={[styles.brand, compact && styles.brandCompact]}>FINORA</Text>
                  <Text style={[styles.product, compact && styles.productCompact]}>{card.label}</Text>
                </View>
              </View>
              <ContactlessMark compact={compact} />
            </View>

            <View style={styles.chipPosition}>
              <EMVChip compact={compact} />
            </View>

            <View style={styles.numberBlock}>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[styles.pan, compact && styles.panCompact]}
              >
                {revealed ? formatPanGrouped(card.pan) : `••••  ••••  ••••  ${card.last4}`}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.metaBlock}>
                <View>
                  <Text style={styles.metaLabel}>VALID THRU</Text>
                  <Text style={[styles.metaValue, compact && styles.metaValueCompact]}>
                    {revealed ? card.expiry : '••/••'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>CARDHOLDER</Text>
                  <Text style={[styles.metaValue, compact && styles.metaValueCompact]}>
                    {cardholder}
                  </Text>
                </View>
              </View>
              <NetworkMark
                network={card.network}
                compact={compact}
              />
            </View>

            {frozen || cancelled ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{cancelled ? 'Cancelled' : 'Frozen'}</Text>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            pointerEvents={side === 'back' ? 'auto' : 'none'}
            style={[styles.faceSide, styles.backFace, padStyle, backFaceStyle]}
          >
            <View style={styles.backWash} />
            <View style={styles.backTop}>
              <Text style={[styles.brand, compact && styles.brandCompact]}>FINORA</Text>
              <NetworkMark
                network={card.network}
                compact={compact}
              />
            </View>
            <View style={styles.magneticStripe} />
            <View style={styles.signatureRow}>
              <View style={styles.signaturePanel}>
                <Text style={styles.signatureLabel}>AUTHORIZED SIGNATURE</Text>
                <Text style={styles.signatureValue}>{cardholder}</Text>
              </View>
              <View style={styles.cvvPanel}>
                <Text style={styles.metaLabel}>CVV</Text>
                <Text style={styles.cvvValue}>{revealed ? card.cvv : '•••'}</Text>
              </View>
            </View>
            <Text style={styles.backHint}>Keep this security code private</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={`${card.label} card ending ${card.last4}`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** Tiny face for list rows — static metal (no sensors). */
export function VirtualCardMiniFace({ card }: { card: VirtualCard }) {
  const frozen = card.status !== 'active';
  return (
    <View style={[styles.miniShadow, frozen && styles.desaturated]}>
      <View style={styles.mini}>
        <View style={styles.miniMetal} />
        <View style={styles.miniWave} />
        <Text style={styles.miniLast4}>{card.last4}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  shadowHero: {},
  shadowCompact: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  shell: {
    ...Rounded,
    borderRadius: CARD_RADIUS,
    // Keep visible so mid-flip foreshortening isn't clipped into a stutter.
    overflow: 'visible',
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  shellHero: {
    aspectRatio: 1.586,
    width: '100%',
  },
  shellCompact: {
    aspectRatio: 1.7,
    width: '100%',
  },
  flipDeck: {
    ...StyleSheet.absoluteFillObject,
  },
  faceSide: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: CARD_RADIUS,
    backgroundColor: '#141416',
  },
  faceHero: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
  },
  faceCompact: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backFace: {
    backgroundColor: '#101113',
  },
  backWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#101113',
  },
  backTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  magneticStripe: {
    height: '25%',
    marginHorizontal: -22,
    backgroundColor: '#030304',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    zIndex: 1,
  },
  signaturePanel: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(235,237,232,0.9)',
  },
  signatureLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 5,
    letterSpacing: 0.8,
    color: 'rgba(20,22,21,0.55)',
  },
  signatureValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 9,
    letterSpacing: 0.7,
    color: '#202220',
  },
  cvvPanel: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cvvValue: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.94)',
  },
  backHint: {
    alignSelf: 'flex-end',
    fontFamily: 'DMSans_400Regular',
    fontSize: 7,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.38)',
    zIndex: 1,
  },
  desaturated: {
    opacity: 0.78,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    paddingRight: 12,
  },
  brand: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    letterSpacing: 3.6,
    color: 'rgba(255,255,255,0.94)',
  },
  brandCompact: {
    fontSize: 12,
    letterSpacing: 2.6,
  },
  product: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    letterSpacing: -0.1,
    color: 'rgba(255,255,255,0.58)',
  },
  productCompact: {
    fontSize: 12,
  },
  statusPill: {
    position: 'absolute',
    top: '43%',
    right: 18,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statusPillText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.8)',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  pan: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 19,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.94)',
  },
  panCompact: {
    fontSize: 14,
    letterSpacing: 1.4,
  },
  chipPosition: {
    position: 'absolute',
    left: '9.5%',
    top: '31%',
    zIndex: 1,
  },
  chipShell: {
    overflow: 'hidden',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  numberBlock: {
    position: 'absolute',
    left: '9.3%',
    right: '8%',
    bottom: '24%',
    zIndex: 1,
  },
  metaBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
  },
  metaLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 6,
    letterSpacing: 1.2,
    color: 'rgba(220,225,223,0.48)',
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.25,
    color: 'rgba(235,239,237,0.9)',
  },
  metaValueCompact: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
  miniShadow: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  mini: {
    width: 54,
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  miniMetal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#222226',
  },
  miniWave: {
    position: 'absolute',
    left: -5,
    right: -5,
    top: 17,
    height: 1,
    backgroundColor: 'rgba(0,201,139,0.5)',
    transform: [{ rotate: '-10deg' }],
  },
  miniLast4: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.9)',
    zIndex: 1,
  },
});
