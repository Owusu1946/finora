import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { ApprovalRequest } from '@/components/approvals/types';

import { FinancialPlanConfirmationCard } from '@/components/approvals/FinancialPlanConfirmationCard';
import {
  PaymentConfirmationCard,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getApproval, resolveApproval } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

function mockTransactionId() {
  const n = Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return `WW-${n}`;
}

export default function ApprovalDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requestApproval, modal } = usePasscodeApproval();

  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<PaymentConfirmationStatus | null>(null);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const next = await getApproval(String(id ?? ''));
    setApproval(next);
    if (next?.transactionId) setTransactionId(next.transactionId);
    if (next?.status === 'approved') setLocalStatus('sent');
    if (next?.status === 'rejected') setLocalStatus('cancelled');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const status: PaymentConfirmationStatus =
    localStatus ??
    (approval?.status === 'approved'
      ? 'sent'
      : approval?.status === 'rejected'
        ? 'cancelled'
        : 'pending');

  useEffect(() => {
    if (status !== 'sending' || !approval) return;

    let cancelled = false;
    const run = async () => {
      for (let step = 0; step < 3; step++) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
      }
      if (cancelled || finishedRef.current) return;
      const txId = transactionId ?? mockTransactionId();
      finishedRef.current = true;
      setTransactionId(txId);
      setLocalStatus('sent');
      haptics.success();

      await resolveApproval(approval.id, 'approved', txId);

      if (approval.kind === 'plan' && approval.plan) {
        const tx = await recordSentPayment({
          payment: {
            amount: approval.plan.total,
            currency: approval.plan.currency,
            recipientName: approval.plan.intent,
            destination: {
              kind: 'bank_account',
              label: 'Financial plan',
              value: `${approval.plan.items.length} line items`,
            },
            reference: approval.plan.planId,
          },
          transactionId: txId,
          source: 'mcp',
        });
        setTxRecordId(tx.id);
      } else if (approval.payment) {
        const tx = await recordSentPayment({
          payment: approval.payment,
          transactionId: txId,
          source: 'mcp',
        });
        setTxRecordId(tx.id);
      }

      setApproval((prev) =>
        prev
          ? {
              ...prev,
              status: 'approved',
              transactionId: txId,
              resolvedAt: new Date().toISOString(),
            }
          : prev,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [approval, status, transactionId]);

  if (loading) {
    return (
      <View className='flex-1 items-center justify-center bg-background'>
        <LoadingIcon color={colors.mutedForeground} />
      </View>
    );
  }

  if (!approval) {
    return (
      <View className='flex-1 items-center justify-center bg-background'>
        <Text className='text-muted-foreground'>Approval not found.</Text>
      </View>
    );
  }

  const isPlan = approval.kind === 'plan' && approval.plan;
  const canOpenTx = status === 'sent' && (txRecordId || transactionId);

  const openTransaction = () => {
    haptics.selection();
    if (txRecordId) {
      router.push(`/transaction/${txRecordId}` as Href);
      return;
    }
    if (transactionId) {
      router.push(`/transaction/${transactionId}` as Href);
    }
  };

  const onConfirm = async () => {
    if (status !== 'pending' || busy) return;
    setBusy(true);
    const ok = await requestApproval();
    setBusy(false);
    if (!ok) return;
    setSendingStep(0);
    setLocalStatus('sending');
  };

  const onCancel = async () => {
    if (status !== 'pending' || busy) return;
    setBusy(true);
    await resolveApproval(approval.id, 'rejected');
    setLocalStatus('cancelled');
    setApproval((prev) =>
      prev ? { ...prev, status: 'rejected', resolvedAt: new Date().toISOString() } : prev,
    );
    setBusy(false);
    haptics.selection();
  };

  return (
    <SwipeBackView>
      <View className='flex-1 bg-background'>
        <ScrollView
          contentContainerStyle={{
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className='gap-1 rounded-2xl bg-muted p-3.5'>
            <Text className='font-sans-semibold text-[13px] tracking-[-0.1px] text-muted-foreground'>
              {isPlan ? 'Agent plan' : 'Agent request'}
            </Text>
            <Text className='font-sans-semibold text-[19px] tracking-[-0.3px] text-foreground'>
              {approval.agent}
            </Text>
            <Text className='font-sans-medium text-sm text-muted-foreground'>
              Prepared via MCP · {new Date(approval.createdAt).toLocaleString()}
            </Text>
          </View>

          {isPlan && approval.plan ? (
            <FinancialPlanConfirmationCard
              plan={approval.plan}
              status={status}
              loading={busy}
              sendingStep={sendingStep}
              transactionId={transactionId}
              onViewDetails={canOpenTx ? openTransaction : undefined}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ) : approval.payment ? (
            <PaymentConfirmationCard
              payment={approval.payment}
              status={status}
              loading={busy}
              sendingStep={sendingStep}
              transactionId={transactionId}
              onViewDetails={canOpenTx ? openTransaction : undefined}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ) : (
            <Text className='text-muted-foreground'>Invalid approval payload.</Text>
          )}

          {status === 'sent' ? (
            <Pressable
              onPress={openTransaction}
              className='min-h-[46px] items-center justify-center rounded-[14px] border border-border'
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className='font-sans-semibold text-base tracking-[-0.2px] text-foreground'>
                View transaction detail
              </Text>
            </Pressable>
          ) : null}

          {status === 'cancelled' ? (
            <Pressable
              onPress={() => {
                haptics.selection();
                router.back();
              }}
              className='min-h-[46px] items-center justify-center rounded-[14px] border border-border'
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className='font-sans-semibold text-base tracking-[-0.2px] text-foreground'>
                Back to inbox
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {modal}
      </View>
    </SwipeBackView>
  );
}
