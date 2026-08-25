import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { sendSms } from '@/lib/sms';

export type ReceiveMethodKind = 'virtual_account' | 'mobile_money' | 'crypto';

export type ReceiveMethod = {
  id: string;
  kind: ReceiveMethodKind;
  currency: string;
  title: string;
  subtitle?: string;
  fields: { label: string; value: string; copyable?: boolean }[];
  /** String encoded into the QR visual */
  qrPayload: string;
};

type ReceiveMoneyCardProps = {
  methods: ReceiveMethod[];
  initialMethodId?: string;
};

function formatDetails(method: ReceiveMethod): string {
  return [
    `Finora · Receive ${method.currency}`,
    method.title,
    ...method.fields.map((f) => `${f.label}: ${f.value}`),
    '',
    `QR payload: ${method.qrPayload}`,
  ].join('\n');
}

export function ReceiveMoneyCard({ methods, initialMethodId }: ReceiveMoneyCardProps) {
  const { colors, isDark } = useTheme();
  const [activeId, setActiveId] = useState(initialMethodId ?? methods[0]?.id ?? '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const active = useMemo(
    () => methods.find((m) => m.id === activeId) ?? methods[0],
    [activeId, methods],
  );

  if (!active) return null;

  const copyValue = async (value: string, key: string) => {
    haptics.selection();
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    haptics.success();
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
  };

  const shareDetails = async () => {
    haptics.selection();
    try {
      await Share.share({
        message: formatDetails(active),
        title: `Receive ${active.currency} · Finora`,
      });
    } catch {
      // ignored
    }
  };

  const textDetails = async () => {
    haptics.selection();
    const result = await sendSms({ message: formatDetails(active) });
    if (!result.ok) {
      haptics.impact();
      Alert.alert('SMS unavailable', result.error);
      return;
    }
    if (result.result === 'sent') haptics.success();
  };

  const shareQr = async () => {
    haptics.selection();
    const message = [
      `Scan this Finora receive code for ${active.currency}.`,
      active.title,
      '',
      active.qrPayload,
      '',
      ...active.fields.map((f) => `${f.label}: ${f.value}`),
    ].join('\n');
    try {
      await Share.share({
        message,
        title: `Finora QR · ${active.currency}`,
      });
    } catch {
      // ignored
    }
  };

  const copyAll = () => void copyValue(formatDetails(active), 'all');

  return (
    <View
      className='my-2 w-full gap-4 overflow-hidden border border-border bg-card p-4'
      style={[styles.card]}
    >
      <View className='flex-row items-center gap-3'>
        <View className='h-10 w-10 items-center justify-center rounded-full bg-foreground'>
          <Icon
            name='arrow-down-left'
            size={16}
            color={colors.background}
          />
        </View>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-medium text-[12px] uppercase text-muted-foreground'>
            Inbound funds
          </Text>
          <Text className='font-sans-semibold text-[20px] text-foreground'>Receive money</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className='flex-row gap-2'>
          {methods.map((method) => {
            const selected = method.id === active.id;
            return (
              <Pressable
                key={method.id}
                onPress={() => {
                  haptics.selection();
                  setActiveId(method.id);
                  setCopiedKey(null);
                }}
                className='flex-row items-center gap-1.5 px-2.5 py-1.5'
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: selected ? colors.foreground : colors.muted,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <CurrencyIcon
                  currency={method.currency}
                  size={18}
                />
                <Text
                  className='font-sans-semibold text-[13px] tracking-[-0.1px]'
                  style={[{ color: selected ? colors.background : colors.foreground }]}
                  numberOfLines={1}
                >
                  {method.currency}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className='gap-1'>
        <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
          {active.title}
        </Text>
        {active.subtitle ? (
          <Text className='font-sans-medium text-[14px] tracking-[-0.1px] leading-[18px] text-muted-foreground'>
            {active.subtitle}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel='Expand QR code'
        onPress={() => {
          haptics.selection();
          setQrOpen(true);
        }}
        className='self-center rounded-[22px] bg-muted p-3'
        style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}
      >
        <MockQrCode
          value={active.qrPayload}
          size={168}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </Pressable>
      <Text className='-mt-2 text-center font-sans text-[12px] text-muted-foreground'>
        Tap to enlarge · {active.currency} receiving code
      </Text>

      <View className='gap-2 rounded-[22px] bg-muted p-2'>
        {active.fields.map((field) => {
          const key = `${active.id}:${field.label}`;
          const copied = copiedKey === key;
          return (
            <View
              key={key}
              className='flex-row items-center gap-2.5 rounded-[18px] border border-border bg-background px-3 py-2.5'
              style={[styles.field]}
            >
              <View className='flex-1 gap-0.5'>
                <Text className='font-sans-medium text-[12px] tracking-[-0.1px] text-muted-foreground'>
                  {field.label}
                </Text>
                <Text
                  selectable
                  className='font-sans-medium text-[15px] tracking-[-0.2px] text-foreground'

                  numberOfLines={2}
                >
                  {field.value}
                </Text>
              </View>
              {field.copyable !== false ? (
                <Pressable
                  accessibilityLabel={`Copy ${field.label}`}
                  hitSlop={8}
                  onPress={() => copyValue(field.value, key)}
                  className='w-[34px] h-[34px] rounded-[17px] items-center justify-center'
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.muted,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Icon
                    name={copied ? 'check' : 'copy'}
                    size={15}
                    color={colors.foreground}
                  />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <View className='gap-2'>
        <Pressable
          onPress={() => void textDetails()}
          className='min-h-[46px] flex-row items-center justify-center gap-2 rounded-full'
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon
            name='phone'
            size={16}
            color={colors.primaryForeground}
          />
          <Text
            className='font-sans-semibold text-[16px]'
            style={{ color: colors.primaryForeground }}
          >
            Text SMS
          </Text>
        </Pressable>

        <View className='flex-row gap-2'>
          <Pressable
            onPress={shareDetails}
            className='flex-1 min-h-11 border flex-row items-center justify-center gap-1.5'
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon
              name='share'
              size={15}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
              Share
            </Text>
          </Pressable>
          <Pressable
            onPress={shareQr}
            className='flex-1 min-h-11 border flex-row items-center justify-center gap-1.5'
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon
              name='qr'
              size={15}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
              Share QR
            </Text>
          </Pressable>
          <Pressable
            onPress={copyAll}
            className='flex-1 min-h-11 border flex-row items-center justify-center gap-1.5'
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon
              name={copiedKey === 'all' ? 'check' : 'copy'}
              size={15}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
              {copiedKey === 'all' ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={qrOpen}
        transparent
        animationType='fade'
        onRequestClose={() => setQrOpen(false)}
      >
        <Pressable
          className='flex-1 items-center justify-center p-6'
          style={[{ backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={() => setQrOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className='w-[100%] max-w-[360px] border p-5 gap-3 items-center bg-background border-border'
            style={[styles.modalCard]}
          >
            <Text className='font-sans-semibold text-[18px] tracking-[-0.3px] text-center text-foreground'>
              {active.title}
            </Text>
            <Text className='font-sans-medium text-[14px] text-center -mt-1 text-muted-foreground'>
              Hold steady — sender scans this code
            </Text>
            <View
              className='p-4 bg-white'
              style={[styles.modalQr]}
            >
              <MockQrCode
                value={active.qrPayload}
                size={240}
                color='#18181b'
                backgroundColor='#ffffff'
              />
            </View>
            <View className='flex-row gap-2 w-[100%] mt-1'>
              <Pressable
                onPress={shareQr}
                className='min-h-[46px] flex-row items-center justify-center gap-2'
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed ? 0.85 : 1,
                    flex: 1,
                  },
                ]}
              >
                <Icon
                  name='share'
                  size={16}
                  color={colors.background}
                />
                <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-background'>
                  Share QR
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  setQrOpen(false);
                }}
                className='flex-1 min-h-11 border flex-row items-center justify-center gap-1.5'
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                    flex: 0,
                    paddingHorizontal: 16,
                  },
                ]}
              >
                <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
                  Done
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  tab: {
    borderRadius: Radius.pill,
  },
  qrWrap: {
    borderRadius: Radius.lg,
  },
  field: {
    borderRadius: Radius.composer,
  },
  primaryBtn: {
    borderRadius: Radius.composer,
  },
  secondaryBtn: {
    borderRadius: Radius.composer,
  },
  modalCard: {
    borderRadius: Radius.card,
  },
  modalQr: {
    borderRadius: Radius.lg,
  },
};
