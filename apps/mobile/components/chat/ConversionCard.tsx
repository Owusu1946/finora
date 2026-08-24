import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

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
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
      <View className='flex-row items-center gap-3'>
        <Animated.View
          className='w-9 h-9 rounded-[18px] items-center justify-center'
          style={[
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
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-medium text-[14px] tracking-[-0.1px] text-muted-foreground'>
            {converting
              ? 'Converting…'
              : failed
                ? 'Conversion failed'
                : cancelled
                  ? 'Conversion cancelled'
                  : 'Confirm conversion'}
          </Text>
          <Text className='font-sans-semibold text-[21px] tracking-[-0.4px] text-foreground'>
            {quote.fromCurrency} → {quote.toCurrency}
          </Text>
        </View>
      </View>

      <View
        className='border p-3 flex-row items-center justify-between gap-2 border-border'
        style={[styles.pair]}
      >
        <View className='flex-row items-center gap-2 flex-1'>
          <CurrencyIcon
            currency={quote.fromCurrency}
            size={28}
          />
          <View>
            <Text className='font-sans-medium text-[12px] text-muted-foreground'>You send</Text>
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
              {formatAmt(quote.fromAmount, quote.fromCurrency)}
            </Text>
          </View>
        </View>
        <Icon
          name='swap'
          size={18}
          color={colors.mutedForeground}
        />
        <View className='flex-row items-center gap-2 flex-1 justify-end'>
          <View style={{ alignItems: 'flex-end' }}>
            <Text className='font-sans-medium text-[12px] text-muted-foreground'>You get</Text>
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
              {formatAmt(quote.toAmount, quote.toCurrency)}
            </Text>
          </View>
          <CurrencyIcon
            currency={quote.toCurrency}
            size={28}
          />
        </View>
      </View>

      <View className='gap-2'>
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
        <View className='gap-2.5'>
          {CONVERT_STEPS.map((label, index) => {
            const done = index < convertingStep;
            const active = index === convertingStep;
            return (
              <View
                key={label}
                className='flex-row items-center gap-2.5'
              >
                <View
                  className='w-[22px] h-[22px] rounded-[11px] border items-center justify-center'
                  style={[
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
                  className='font-sans text-[15px] tracking-[-0.2px]'
                  style={[
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
        <View className='flex-row gap-2.5'>
          <Pressable
            disabled={loading}
            onPress={() => {
              haptics.selection();
              onCancel?.();
            }}
            className='flex-1 min-h-[46px] items-center justify-center border'
            style={({ pressed }) => [
              {
                borderColor: colors.border,
                opacity: pressed || loading ? 0.7 : 1,
              },
            ]}
          >
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            disabled={loading}
            onPress={() => {
              haptics.impact();
              onConfirm?.();
            }}
            className='flex-1 min-h-[46px] items-center justify-center'
            style={({ pressed }) => [
              {
                backgroundColor: colors.foreground,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-background'>
              {loading ? 'Confirming…' : 'Confirm & convert'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {cancelled || failed ? (
        <View
          className='flex-row items-center gap-2 self-start px-3 py-2 bg-destructive-surface'
          style={[styles.statusPill]}
        >
          <Icon
            name='remove'
            size={14}
            color={colors.destructive}
          />
          <Text className='font-sans-semibold text-[14px] text-destructive'>
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
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
      <Animated.View
        className='items-center gap-2 pt-2'
        style={[{ opacity, transform: [{ scale }] }]}
      >
        <View className='w-16 h-16 rounded-[32px] items-center justify-center mb-1 bg-muted'>
          <Icon
            name='check'
            size={28}
            color={colors.foreground}
          />
        </View>
        <Text className='font-sans-semibold text-[16px] text-foreground'>Converted</Text>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          {formatAmt(quote.toAmount, quote.toCurrency)}
        </Text>
        <Text className='font-sans-medium text-[15px] mb-2 text-muted-foreground'>
          from {formatAmt(quote.fromAmount, quote.fromCurrency)}
        </Text>

        <View className='w-[100%] border-t pt-3.5 gap-2.5 border-border'>
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
  colors: _colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View className='gap-0.5'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text
        selectable
        className='font-sans-medium text-[15px] tracking-[-0.1px] text-foreground'
      >
        {value}
      </Text>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  pair: {
    borderRadius: Radius.composer,
  },
  btn: {
    borderRadius: Radius.composer,
  },
  statusPill: {
    borderRadius: Radius.pill,
  },
};
