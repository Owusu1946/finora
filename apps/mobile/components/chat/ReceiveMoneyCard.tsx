import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

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

function kindIcon(kind: ReceiveMethodKind): 'bank' | 'phone' | 'wallet' {
  if (kind === 'virtual_account') return 'bank';
  if (kind === 'mobile_money') return 'phone';
  return 'wallet';
}

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
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Icon
            name='arrow-down-left'
            size={16}
            color={colors.foreground}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Receive money</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Share payment details</Text>
        </View>
      </View>

      <View style={styles.tabs}>
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
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: selected ? colors.foreground : colors.muted,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Icon
                name={kindIcon(method.kind)}
                size={13}
                color={selected ? colors.background : colors.foreground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: selected ? colors.background : colors.foreground },
                ]}
                numberOfLines={1}
              >
                {method.currency}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.methodHead}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>{active.title}</Text>
        {active.subtitle ? (
          <Text style={[styles.methodSub, { color: colors.mutedForeground }]}>
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
        style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}
      >
        <MockQrCode
          value={active.qrPayload}
          size={168}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </Pressable>
      <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
        Tap QR to enlarge · Scan to pay · {active.currency}
      </Text>

      <View style={styles.fields}>
        {active.fields.map((field) => {
          const key = `${active.id}:${field.label}`;
          const copied = copiedKey === key;
          return (
            <View
              key={key}
              style={[styles.field, { borderColor: colors.border }]}
            >
              <View style={styles.fieldText}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {field.label}
                </Text>
                <Text
                  selectable
                  style={[styles.fieldValue, { color: colors.foreground }]}
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
                  style={({ pressed }) => [
                    styles.copyBtn,
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

      <View style={styles.actions}>
        <Pressable
          onPress={shareDetails}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.foreground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon
            name='share'
            size={16}
            color={colors.background}
          />
          <Text style={[styles.primaryLabel, { color: colors.background }]}>Share details</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            onPress={shareQr}
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
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Share QR</Text>
          </Pressable>
          <Pressable
            onPress={copyAll}
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
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>
              {copiedKey === 'all' ? 'Copied' : 'Copy all'}
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
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={() => setQrOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {active.title}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Hold steady — sender scans this code
            </Text>
            <View style={styles.modalQr}>
              <MockQrCode
                value={active.qrPayload}
                size={240}
                color='#18181b'
                backgroundColor='#ffffff'
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={shareQr}
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
                <Text style={[styles.primaryLabel, { color: colors.background }]}>
                  Share QR
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  setQrOpen(false);
                }}
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
                <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  methodHead: {
    gap: 4,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  methodSub: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: Radius.lg,
  },
  qrHint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -4,
  },
  fields: {
    gap: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: 8,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -4,
  },
  modalQr: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 4,
  },
});
