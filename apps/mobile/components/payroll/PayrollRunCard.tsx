import type { PayrollRun } from '@finora/shared';

import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import type { WalletItem } from '@/components/wallets/types';

import { CardFundingSource, useFundingWallets } from '@/components/cards/CardFundingSource';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { cancelPayrollRun, getPayrollRun } from '@/lib/payroll-api';
import { canFundPayroll, payPayrollRun, payrollCostIn } from '@/lib/payroll-funding';

const COLLAPSED_ITEMS = 6;
/** Delay between employees turning "sent" on the receipt, so the run reads as it settles. */
const REVEAL_STEP_MS = 140;

/** The same-currency wallet if it can cover the run, else the first one that can. */
function defaultWalletId(wallets: WalletItem[], run: PayrollRun) {
  const same = wallets.find((wallet) => wallet.currency === run.currency);
  if (same && canFundPayroll(same, run)) return same.id;
  return wallets.find((wallet) => canFundPayroll(wallet, run))?.id ?? null;
}

function title(run: PayrollRun) {
  if (run.kind === 'single') return run.items[0]?.employeeName ?? 'Employee payment';
  return run.period ? `Payroll · ${run.period}` : 'Payroll';
}

function statusLine(run: PayrollRun) {
  if (run.status === 'completed') return run.kind === 'single' ? 'Paid' : 'Payroll paid';
  if (run.status === 'cancelled') return 'Cancelled';
  if (run.status === 'failed') return 'Payment failed';
  return run.kind === 'single' ? 'Employee payment ready' : 'Payroll ready';
}

/**
 * A prepared payroll (or one employee payment): review, pick the account to pay
 * from, approve with the passcode, then see each payout settle.
 */
export function PayrollRunCard({ run: prepared }: { run: PayrollRun }) {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const aui = useAui();
  const wallets = useFundingWallets();
  const { requestApproval, modal } = usePasscodeApproval();
  const [run, setRun] = useState(prepared);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(Number.POSITIVE_INFINITY);

  // The API is the source of truth: a reloaded chat shows whether it was paid.
  useEffect(() => {
    let active = true;
    void getPayrollRun(getToken, prepared.id)
      .then((latest) => {
        if (active) setRun(latest);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getToken, prepared.id]);

  const pending = run.status === 'pending_approval';
  const wallet = wallets.find((item) => item.id === walletId) ?? null;

  useEffect(() => {
    if (!pending || wallets.length === 0) return;
    if (wallet && canFundPayroll(wallet, run)) return;
    setWalletId(defaultWalletId(wallets, run));
  }, [pending, run, wallet, wallets]);

  const items = useMemo(
    () => (expanded ? run.items : run.items.slice(0, COLLAPSED_ITEMS)),
    [expanded, run.items],
  );

  const pay = async () => {
    if (!wallet || busy) return;
    setBusy('pay');
    try {
      const approved = await requestApproval();
      if (!approved) return;
      const paid = await payPayrollRun(getToken, run, wallet.id);
      setRevealed(0);
      setRun(paid);
      haptics.success();
      paid.items.forEach((_, index) =>
        setTimeout(() => setRevealed(index + 1), (index + 1) * REVEAL_STEP_MS),
      );
      const people = paid.items.length;
      appendAgentFollowUp(
        aui,
        `Paid ${people === 1 ? (paid.items[0]?.employeeName ?? '1 person') : `${people} people`} ${formatPaymentAmount(paid.total, paid.currency)} from your ${wallet.name} wallet. These are demo payouts until live payouts are switched on.`,
      );
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't pay", error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (busy) return;
    haptics.selection();
    setBusy('cancel');
    try {
      setRun(await cancelPayrollRun(getToken, run.id));
    } catch (error) {
      Alert.alert("Couldn't cancel", error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const paidWallet = run.funding && wallets.find((item) => item.id === run.funding?.walletId)?.name;

  return (
    <>
      <View
        className='my-2 gap-4 border border-border bg-composer p-5'
        style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
      >
        <View className='flex-row items-center gap-3'>
          <View className='size-9 items-center justify-center rounded-full bg-muted'>
            <Icon
              name={run.status === 'completed' ? 'check' : 'contacts'}
              size={16}
              color={colors.foreground}
            />
          </View>
          <View className='min-w-0 flex-1 gap-0.5'>
            <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
              {statusLine(run)}
            </Text>
            <Text
              className='font-sans-semibold text-[16px] text-foreground'
              numberOfLines={1}
            >
              {title(run)}
            </Text>
          </View>
          <Text className='font-sans-semibold text-[16px] tabular-nums text-foreground'>
            {formatPaymentAmount(run.total, run.currency)}
          </Text>
        </View>

        <View className='gap-2.5'>
          {items.map((item, index) => {
            const sent = item.status === 'sent' && index < revealed;
            return (
              <View
                key={item.id}
                className='flex-row items-center gap-2.5'
              >
                <View className='min-w-0 flex-1 gap-0.5'>
                  <Text
                    className='font-sans-semibold text-[15px] text-foreground'
                    numberOfLines={1}
                  >
                    {item.employeeName}
                  </Text>
                  <Text
                    className='font-sans-medium text-[13px] text-muted-foreground'
                    numberOfLines={1}
                  >
                    {[item.role, `${item.destination.label} ${item.destination.value}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text className='font-sans-medium text-[15px] tabular-nums text-foreground'>
                  {formatPaymentAmount(item.amount, run.currency)}
                </Text>
                {run.status === 'completed' ? (
                  sent ? (
                    <Icon
                      name='check'
                      size={16}
                      color={colors.foreground}
                    />
                  ) : (
                    <LoadingIcon color={colors.mutedForeground} />
                  )
                ) : null}
              </View>
            );
          })}
          {run.items.length > COLLAPSED_ITEMS ? (
            <Pressable
              onPress={() => setExpanded((value) => !value)}
              className='active:opacity-70'
            >
              <Text className='font-sans-semibold text-[14px] text-foreground'>
                {expanded ? 'Show less' : `Show all ${run.items.length}`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {pending ? (
          <View className='gap-2'>
            <Text className='font-sans-semibold text-[15px] text-foreground'>Pay from</Text>
            <CardFundingSource
              wallets={wallets}
              isAffordable={(item) => canFundPayroll(item, run)}
              selectedId={walletId}
              onSelect={setWalletId}
            />
            {wallet && wallet.currency !== run.currency ? (
              <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
                ≈ {formatPaymentAmount(payrollCostIn(wallet, run), wallet.currency)} from your{' '}
                {wallet.name} wallet. No fees.
              </Text>
            ) : (
              <Text className='font-sans text-[13px] text-muted-foreground'>No fees.</Text>
            )}
          </View>
        ) : null}

        {run.status === 'completed' && run.funding ? (
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            Paid {formatPaymentAmount(run.funding.amount, run.funding.currency)}
            {paidWallet ? ` from your ${paidWallet} wallet` : ''}.
            {run.mode === 'demo' ? ' Demo payouts: nobody was really paid.' : ''}
          </Text>
        ) : null}

        {pending ? (
          <View className='flex-row gap-2'>
            <Pressable
              accessibilityRole='button'
              disabled={busy !== null}
              onPress={() => void cancel()}
              className='min-h-11 flex-1 items-center justify-center rounded-full bg-muted px-4 active:opacity-75 disabled:opacity-50'
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                {busy === 'cancel' ? 'Cancelling' : 'Cancel'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              disabled={busy !== null || !wallet}
              onPress={() => void pay()}
              className={cx(
                'min-h-11 flex-[2] flex-row items-center justify-center gap-2 rounded-full bg-foreground px-4 active:opacity-85 disabled:opacity-50',
              )}
            >
              {busy === 'pay' ? <LoadingIcon color={colors.background} /> : null}
              <Text className='font-sans-semibold text-[15px] text-background'>
                {busy === 'pay' ? 'Paying' : 'Approve and pay'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}
