import { View } from 'react-native';

import type { TransactionTimelineStep } from '@/components/activity/types';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';

function formatStepTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TransactionTimeline({ steps }: { steps: TransactionTimelineStep[] }) {
  const { colors } = useTheme();

  return (
    <View>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const done = step.status === 'done';
        const active = step.status === 'active';
        const failed = step.status === 'failed';
        const accent = failed ? '#EF4444' : done || active ? colors.foreground : colors.border;

        return (
          <View
            key={step.id}
            className='flex-row gap-3'
          >
            <View className='w-[22px] items-center'>
              <View
                className='h-[22px] w-[22px] items-center justify-center rounded-full border'
                style={{
                  borderColor: accent,
                  backgroundColor: done || failed ? accent : 'transparent',
                }}
              >
                {done ? (
                  <Icon
                    name='check'
                    size={10}
                    color={colors.background}
                  />
                ) : failed ? (
                  <Icon
                    name='remove'
                    size={10}
                    color={colors.background}
                  />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  className='my-1 min-h-[18px] flex-1 border-l'
                  style={{ borderColor: done ? colors.foreground : colors.border }}
                />
              ) : null}
            </View>

            <View className={cx('flex-1 gap-0.5 pt-0.5', !isLast && 'pb-3.5')}>
              <Text
                className={cx('text-[15px]', active ? 'font-sans-semibold' : 'font-sans-medium')}
                style={{
                  color: failed || done || active ? colors.foreground : colors.mutedForeground,
                }}
              >
                {step.label}
                {active ? '…' : ''}
              </Text>
              {step.at ? (
                <Text className='font-sans text-[13px] text-muted-foreground'>
                  {formatStepTime(step.at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
