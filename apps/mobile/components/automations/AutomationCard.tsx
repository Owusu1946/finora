import { describeAutomation, type AutomationRecord } from '@finora/shared';
import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function lastRunLine(automation: AutomationRecord) {
  if (!automation.lastTriggeredAt) {
    return automation.totalRuns > 0 ? 'Checked, but hasn’t needed to run yet' : 'Hasn’t run yet';
  }
  const failed = automation.lastRunStatus === 'failed' ? ' · last run failed' : '';
  return `Last ran ${timeAgo(automation.lastTriggeredAt)}${failed}`;
}

function CardButton({
  label,
  tone = 'secondary',
  disabled,
  onPress,
}: {
  label: string;
  tone?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole='button'
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'min-h-[40px] flex-1 items-center justify-center rounded-full px-3 active:opacity-75 disabled:opacity-40',
        tone === 'primary' ? 'bg-foreground' : 'bg-muted',
      )}
    >
      <Text
        className={cx(
          'font-sans-semibold text-[14px]',
          tone === 'primary'
            ? 'text-background'
            : tone === 'destructive'
              ? 'text-destructive'
              : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AutomationCard({
  automation,
  busy,
  onRun,
  onToggle,
  onDelete,
}: {
  automation: AutomationRecord;
  busy: boolean;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const active = automation.status === 'active';
  return (
    <View
      className='gap-2.5 rounded-[26px] border border-border bg-composer p-4'
      style={{ borderCurve: 'continuous' }}
    >
      <View className='flex-row items-center gap-2'>
        <Text
          className='flex-1 font-sans-semibold text-[16px] text-foreground'
          numberOfLines={1}
        >
          {automation.name}
        </Text>
        <View className={cx('rounded-full px-2.5 py-1', active ? 'bg-emerald-500/15' : 'bg-muted')}>
          <Text
            className={cx(
              'font-sans-semibold text-[12px]',
              active ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          >
            {active ? 'On' : 'Paused'}
          </Text>
        </View>
      </View>
      <Text className='font-sans text-[14px] leading-5 text-foreground'>
        {describeAutomation(automation)}
      </Text>
      <Text className='font-sans text-[13px] text-muted-foreground'>{lastRunLine(automation)}</Text>
      <View className='mt-1 flex-row gap-2'>
        <CardButton
          label='Run now'
          tone='primary'
          disabled={busy || !active}
          onPress={onRun}
        />
        <CardButton
          label={active ? 'Pause' : 'Resume'}
          disabled={busy}
          onPress={onToggle}
        />
        <CardButton
          label='Delete'
          tone='destructive'
          disabled={busy}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}
