import type { PlanResult, PreparedAction } from '@finora/shared';

import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  actionErrorMessage,
  cancelAction,
  executeAction,
  getAction,
  reviewActionPolicy,
} from '@/lib/actions-api';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';

/** Delay between each item's tick once the plan has run. */
const REVEAL_STEP_MS = 280;

type Item = { title: string; amount: number; currency?: string; category?: string };

type Result = {
  ok?: boolean;
  empty?: boolean;
  actionId?: string;
  items?: Item[];
  total?: number;
  currency?: string;
  notes?: string[];
};

type Phase = 'pending' | 'running' | 'done' | 'cancelled';

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <View className='gap-1.5'>
      {notes.map((note) => (
        <Text
          key={note}
          className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'
        >
          · {note}
        </Text>
      ))}
    </View>
  );
}

function DailyPlanCard({ actionId, fallback }: { actionId: string; fallback: Result }) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [action, setAction] = useState<PreparedAction | null>(null);
  const [phase, setPhase] = useState<Phase>('pending');
  const [revealed, setRevealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const followedUpRef = useRef(false);

  // The chat may be reopened after approving: show how each item went.
  useEffect(() => {
    let disposed = false;
    void getAction(actionId)
      .then((loaded) => {
        if (disposed) return;
        setAction(loaded);
        if (loaded.results) {
          followedUpRef.current = true;
          setRevealed(loaded.results.length);
          setPhase('done');
        } else if (loaded.status === 'cancelled') setPhase('cancelled');
        else if (loaded.status === 'executing') setPhase('running');
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [actionId]);

  const items: Item[] = action?.items ?? fallback.items ?? [];
  const notes = action?.notes ?? fallback.notes ?? [];
  const currency = action?.currency ?? fallback.currency ?? 'USD';
  const total = action?.amount ?? fallback.total ?? 0;
  const results: PlanResult[] = action?.results ?? [];

  const approve = async () => {
    if (phase !== 'pending' || busy) return;
    setBusy(true);
    const ok = (await reviewActionPolicy(actionId)) && (await requestApproval());
    setBusy(false);
    if (!ok) return;
    setError(null);
    setPhase('running');
    try {
      const ran = await executeAction(actionId);
      setAction(ran);
      setPhase('done');
      const count = ran.results?.length ?? 0;
      for (let index = 1; index <= count; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, REVEAL_STEP_MS));
        setRevealed(index);
      }
      const failed = ran.results?.filter((result) => result.status === 'failed') ?? [];
      if (failed.length) haptics.error();
      else haptics.success();
      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(
          aui,
          failed.length
            ? `Done, except ${failed.length} of ${count}: ${failed.map((item) => `${item.title} (${item.error ?? 'didn’t go through'})`).join('; ')}. Nothing moved for those.`
            : `Everything is done: ${count} ${count === 1 ? 'item' : 'items'} paid. It's all in Activity.`,
        );
      }
    } catch (cause) {
      haptics.error();
      setPhase('pending');
      setError(actionErrorMessage(cause));
    }
  };

  return (
    <>
      <View
        className='w-[100%] border p-5 gap-4 my-2 bg-composer border-border'
        style={styles.card}
      >
        <View className='gap-0.5'>
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            {phase === 'done'
              ? "Today's plan · done"
              : phase === 'running'
                ? 'Paying…'
                : phase === 'cancelled'
                  ? "Today's plan · cancelled"
                  : "Today's plan"}
          </Text>
          <Text className='font-sans-semibold text-[27px] tracking-[-0.6px] tabular-nums text-foreground'>
            {formatPaymentAmount(total, currency)}
          </Text>
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            {items.length} {items.length === 1 ? 'item' : 'items'} · total at demo rates
          </Text>
        </View>

        <View className='h-px bg-border' />

        <View className='gap-3'>
          {items.map((item, index) => {
            const result = index < revealed ? results[index] : undefined;
            return (
              <View
                key={`${item.title}-${index}`}
                className='flex-row items-center gap-3'
              >
                <View className='w-6 h-6 rounded-full items-center justify-center bg-muted'>
                  {result ? (
                    <Icon
                      name={result.status === 'paid' ? 'check' : 'remove'}
                      size={13}
                      color={colors.foreground}
                    />
                  ) : phase === 'running' || (phase === 'done' && index >= revealed) ? (
                    <LoadingIcon
                      size='small'
                      color={colors.mutedForeground}
                    />
                  ) : null}
                </View>
                <View className='flex-1 min-w-0'>
                  <Text
                    className='font-sans-medium text-[15px] text-foreground'
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                    {result?.status === 'failed' ? result.error : item.category}
                  </Text>
                </View>
                <Text className='font-sans-medium text-[15px] tabular-nums text-foreground'>
                  {formatPaymentAmount(item.amount, item.currency ?? currency)}
                </Text>
              </View>
            );
          })}
        </View>

        <Notes notes={notes} />

        {error ? (
          <Text className='font-sans-medium text-[14px] text-destructive'>{error}</Text>
        ) : null}

        {phase === 'pending' ? (
          <View className='flex-row gap-2.5'>
            <Pressable
              disabled={busy}
              onPress={() => {
                haptics.selection();
                void cancelAction(actionId)
                  .then(() => setPhase('cancelled'))
                  .catch(() => undefined);
              }}
              className='flex-1 min-h-[46px] items-center justify-center rounded-full px-4'
              style={({ pressed }) => ({
                backgroundColor: colors.muted,
                opacity: pressed || busy ? 0.7 : 1,
              })}
            >
              <Text className='font-sans-semibold text-[16px] text-foreground'>Not now</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={approve}
              className='flex-[1.4] min-h-[46px] items-center justify-center rounded-full px-4'
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                opacity: pressed || busy ? 0.85 : 1,
              })}
            >
              <Text
                style={{ color: colors.primaryForeground }}
                className='font-sans-semibold text-[16px]'
              >
                Approve all
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const DailyPlanToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'prepare_daily_plan',
  display: 'standalone',
  render: function DailyPlanToolContent({ result, status }) {
    const { colors } = useTheme();
    if (!result) {
      return status.type === 'running' ? (
        <View
          className='my-2 min-h-[72px] border items-center justify-center gap-2 border-border bg-composer'
          style={styles.card}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-[13px] text-muted-foreground'>
            Reviewing what needs attention…
          </Text>
        </View>
      ) : null;
    }
    if (!result.actionId) {
      return (
        <View
          className='my-2 border p-4 gap-2 border-border bg-composer'
          style={styles.card}
        >
          <Text className='font-sans-semibold text-[15px] text-foreground'>
            Nothing needs attention today
          </Text>
          <Notes notes={result.notes ?? []} />
        </View>
      );
    }
    return (
      <DailyPlanCard
        actionId={result.actionId}
        fallback={result}
      />
    );
  },
});

const styles = {
  card: { borderRadius: Radius.card },
};
