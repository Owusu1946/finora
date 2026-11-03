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
import { Radius, Rounded } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { actionErrorMessage } from '@/lib/actions-api';
import { getApproval, resolveApproval } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';

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
  const [error, setError] = useState<string | null>(null);
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
      const steps = (async () => {
        for (let step = 0; step < 3; step++) {
          if (cancelled) return;
          setSendingStep(step);
          await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
        }
      })();
      let resolved;
      try {
        [resolved] = await Promise.all([resolveApproval(approval.id, 'approved'), steps]);
      } catch (cause) {
        if (cancelled) return;
        haptics.error();
        setError(actionErrorMessage(cause));
        setLocalStatus('failed');
        return;
      }
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      setTransactionId(resolved.transactionId);
      setTxRecordId(resolved.transactionId ?? null);
      setLocalStatus('sent');
      haptics.success();
      setApproval(resolved);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [approval, status]);

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
    try {
      setApproval(await resolveApproval(approval.id, 'rejected'));
      setLocalStatus('cancelled');
      haptics.selection();
    } catch (cause) {
      setError(actionErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SwipeBackView>
      <View className='flex-1 bg-background'>
        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className='gap-1.5 bg-muted p-5'
            style={{ borderRadius: Radius.card, borderCurve: Rounded.borderCurve }}
          >
            <Text className='font-sans-semibold text-[13px] tracking-[-0.1px] text-muted-foreground'>
              {isPlan ? 'Agent plan' : 'Agent request'}
            </Text>
            <Text className='font-sans-semibold text-[17px] tracking-[-0.2px] text-foreground'>
              {approval.agent}
            </Text>
            <Text className='font-sans-medium text-[14px] text-muted-foreground'>
              Prepared {new Date(approval.createdAt).toLocaleString()} · Demo, no real money moves
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

          {error ? (
            <Text className='font-sans-medium text-[14px] leading-5 text-destructive'>{error}</Text>
          ) : null}

          {status === 'sent' && !canOpenTx ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Back to approvals'
              onPress={() => {
                haptics.selection();
                router.back();
              }}
              className='min-h-[46px] items-center justify-center rounded-full px-5 bg-muted active:opacity-75'
            >
              <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                Back to approvals
              </Text>
            </Pressable>
          ) : null}

          {status === 'cancelled' ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Back to approvals'
              onPress={() => {
                haptics.selection();
                router.back();
              }}
              className='min-h-[46px] items-center justify-center rounded-full px-5 bg-muted active:opacity-75'
            >
              <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
                Back to approvals
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {modal}
      </View>
    </SwipeBackView>
  );
}
