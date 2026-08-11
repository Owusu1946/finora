import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export type ConversionQuote = {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee?: number;
  feeCurrency?: string;
};

export type ConversionStatus = 'pending' | 'converting' | 'converted' | 'cancelled' | 'failed';

type ConversionCardProps = {
  quote: ConversionQuote;
  status?: ConversionStatus;
  loading?: boolean;
  convertingStep?: number;
  conversionId?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const CONVERT_STEPS = ['Locking rate', 'Debiting source', 'Crediting destination'] as const;

function formatAmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ConversionCard({
  quote,
  status = 'pending',
  loading = false,
  convertingStep = 0,
  conversionId,
  onConfirm,
  onCancel,
}: ConversionCardProps) {
  const { colors } = useTheme();
  const pending = status === 'pending';
  const converting = status === 'converting';
  const converted = status === 'converted';
  const cancelled = status === 'cancelled';
  const failed = status === 'failed';

  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!converting) {
      pulse.setValue(0.45);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [converting, pulse]);

  if (converted) {
    return (
      <ConvertedHero
        quote={quote}
        conversionId={conversionId}
      />
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.iconWrap,
            {
              backgroundColor: failed ? colors.destructiveSurface : colors.muted,
              opacity: converting ? pulse : 1,
            },
          ]}
        >
          {converting ? (
            <LoadingIcon
              size='small'
              color={colors.foreground}
            />
          ) : (
            <Icon
              name={failed ? 'remove' : 'swap'}
              size={16}
              color={failed ? colors.destructive : colors.foreground}
            />
          )}
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            {converting
              ? 'Converting…'
              : failed
                ? 'Conversion failed'
                : cancelled
                  ? 'Conversion cancelled'
                  : 'Confirm conversion'}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {quote.fromCurrency} → {quote.toCurrency}
          </Text>
        </View>
      </View>

      <View style={[styles.pair, { borderColor: colors.border }]}>
        <View style={styles.leg}>
          <CurrencyIcon
            currency={quote.fromCurrency}
            size={28}
          />
          <View>
            <Text style={[styles.legLabel, { color: colors.mutedForeground }]}>You send</Text>
            <Text style={[styles.legValue, { color: colors.foreground }]}>
              {formatAmt(quote.fromAmount, quote.fromCurrency)}
            </Text>
          </View>
        </View>
        <Icon
          name='swap'
          size={18}
          color={colors.mutedForeground}
        />
        <View style={[styles.leg, styles.legEnd]}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.legLabel, { color: colors.mutedForeground }]}>You get</Text>
            <Text style={[styles.legValue, { color: colors.foreground }]}>
              {formatAmt(quote.toAmount, quote.toCurrency)}
            </Text>
          </View>
          <CurrencyIcon
            currency={quote.toCurrency}
            size={28}
          />
        </View>
      </View>

      <View style={styles.meta}>
        <MetaRow
          label='Rate'
          value={`1 ${quote.fromCurrency} = ${quote.rate.toFixed(4)} ${quote.toCurrency}`}
          colors={colors}
        />
        {quote.fee != null ? (
          <MetaRow
            label='Fee'
            value={formatAmt(quote.fee, quote.feeCurrency ?? quote.fromCurrency)}
            colors={colors}
          />
        ) : null}
      </View>

      {converting ? (
        <View style={styles.steps}>
          {CONVERT_STEPS.map((label, index) => {
            const done = index < convertingStep;
            const active = index === convertingStep;
            return (
              <View
                key={label}
                style={styles.stepRow}
              >
                <View
                  style={[
                    styles.stepDot,
                    {
                      borderColor: done || active ? colors.foreground : colors.border,
                      backgroundColor: done ? colors.foreground : 'transparent',
                    },
                  ]}
                >
                  {done ? (
                    <Icon
                      name='check'
                      size={10}
                      color={colors.background}
                    />
                  ) : active ? (
                    <LoadingIcon
                      size='small'
                      color={colors.foreground}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: done || active ? colors.foreground : colors.mutedForeground,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {label}
                  {active ? '…' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {pending ? (
        <View style={styles.actions}>
          <Pressable
            disabled={loading}
            onPress={() => {
              haptics.selection();
              onCancel?.();
            }}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGhost,
              {
                borderColor: colors.border,
                opacity: pressed || loading ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={loading}
            onPress={() => {
              haptics.impact();
              onConfirm?.();
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.foreground,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>
              {loading ? 'Confirming…' : 'Confirm & convert'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {cancelled || failed ? (
        <View style={[styles.statusPill, { backgroundColor: colors.destructiveSurface }]}>
          <Icon
            name='remove'
            size={14}
            color={colors.destructive}
          />
          <Text style={[styles.statusText, { color: colors.destructive }]}>
            {failed ? 'Couldn’t complete conversion' : 'Cancelled'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ConvertedHero({ quote, conversionId }: { quote: ConversionQuote; conversionId?: string }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
        },
      ]}
    >
      <Animated.View style={[styles.sentHero, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.sentBadge, { backgroundColor: colors.muted }]}>
          <Icon
            name='check'
            size={28}
            color={colors.foreground}
          />
        </View>
        <Text style={[styles.sentTitle, { color: colors.foreground }]}>Converted</Text>
        <Text style={[styles.sentAmount, { color: colors.foreground }]}>
          {formatAmt(quote.toAmount, quote.toCurrency)}
        </Text>
        <Text style={[styles.sentTo, { color: colors.mutedForeground }]}>
          from {formatAmt(quote.fromAmount, quote.fromCurrency)}
        </Text>

        <View style={[styles.receipt, { borderColor: colors.border }]}>
          <MetaRow
            label='Rate'
            value={`1 ${quote.fromCurrency} = ${quote.rate.toFixed(4)} ${quote.toCurrency}`}
            colors={colors}
          />
          {conversionId ? (
            <MetaRow
              label='Conversion'
              value={conversionId}
              colors={colors}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        selectable
        style={[styles.metaValue, { color: colors.foreground }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  pair: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legEnd: {
    justifyContent: 'flex-end',
  },
  legLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
  legValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: {
    gap: 8,
  },
  metaRow: {
    gap: 2,
  },
  metaLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  metaValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  sentHero: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  sentBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sentTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  sentAmount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  sentTo: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  receipt: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 10,
  },
});
