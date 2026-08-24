import { useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { sendSms } from '@/lib/sms';
import {
  dismissSmsRequest,
  markSmsRequestPaid,
  type SmsPaymentRequest,
} from '@/lib/sms-requests-storage';
import { recordSentPayment } from '@/lib/transactions-storage';

function mockTransactionId() {
  return `WW-SMS-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function formatReceived(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SmsRequestCard({ request: initial }: { request: SmsPaymentRequest }) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [request, setRequest] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'paid' | 'dismissed'>(
    initial.status === 'paid' ? 'paid' : initial.status === 'dismissed' ? 'dismissed' : 'idle',
  );
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      const updated = await markSmsRequestPaid(request.id, txId);
      if (updated) setRequest(updated);
      setPhase('paid');
      haptics.success();
      if (request.amount && request.currency) {
        await recordSentPayment({
          payment: {
            amount: request.amount,
            currency: request.currency,
            recipientName: request.fromName,
            destination: {
              kind: request.network?.toLowerCase().includes('momo')
                ? 'mobile_money'
                : 'bank_account',
              label: request.network ?? 'SMS request',
              value: request.fromPhone,
            },
            reference: `SMS from ${request.fromName}`,
          },
          transactionId: txId,
          source: 'chat',
        });
      }
      appendAgentFollowUp(
        aui,
        `Paid ${request.fromName}${
          request.amount && request.currency
            ? ` ${formatPaymentAmount(request.amount, request.currency)}`
            : ''
        } from an SMS request. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, phase, request]);

  const idle = phase === 'idle';
  const canPay = idle && request.amount != null && request.currency;

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            {phase === 'sending' ? (
              <LoadingIcon
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={phase === 'paid' ? 'check' : 'phone'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'paid'
                ? 'Paid from SMS'
                : phase === 'sending'
                  ? 'Paying…'
                  : phase === 'dismissed'
                    ? 'Dismissed'
                    : 'SMS payment request'}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{request.fromName}</Text>
          </View>
          {request.amount != null && request.currency ? (
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatPaymentAmount(request.amount, request.currency)}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.body, { color: colors.foreground }]}>{request.body}</Text>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {request.fromPhone}
            {request.network ? ` · ${request.network}` : ''}
          </Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            Received {formatReceived(request.receivedAt)}
          </Text>
        </View>

        {idle ? (
          <View style={styles.actions}>
            {canPay ? (
              <Pressable
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const ok = await requestApproval();
                  setBusy(false);
                  if (!ok) return;
                  setPhase('sending');
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed || busy ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnLabel, { color: colors.background }]}>Pay now</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                const reply = request.network?.toLowerCase().includes('momo')
                  ? 'PAY'
                  : `Re: ${request.body.slice(0, 80)}`;
                const result = await sendSms({
                  addresses: request.fromPhone,
                  message: reply,
                });
                if (!result.ok) {
                  haptics.impact();
                  Alert.alert('SMS unavailable', result.error);
                } else if (result.result === 'sent') {
                  haptics.success();
                }
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Reply SMS</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={async () => {
                haptics.selection();
                setBusy(true);
                const updated = await dismissSmsRequest(request.id);
                if (updated) setRequest(updated);
                setPhase('dismissed');
                setBusy(false);
              }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    marginVertical: 6,
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
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  meta: {
    gap: 2,
  },
  metaText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  btn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {},
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
