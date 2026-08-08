import { StyleSheet, Text, View } from 'react-native';

import type { TransactionTimelineStep } from '@/components/activity/types';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

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
    <View style={styles.root}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const done = step.status === 'done';
        const active = step.status === 'active';
        const failed = step.status === 'failed';
        const accent = failed ? '#EF4444' : done || active ? colors.foreground : colors.border;

        return (
          <View
            key={step.id}
            style={styles.row}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: accent,
                    backgroundColor: done || failed ? accent : 'transparent',
                  },
                ]}
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
                  style={[
                    styles.line,
                    { backgroundColor: done ? colors.foreground : colors.border },
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.body, !isLast && styles.bodyPad]}>
              <Text
                style={[
                  styles.label,
                  {
                    color: failed || done || active ? colors.foreground : colors.mutedForeground,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {step.label}
                {active ? '…' : ''}
              </Text>
              {step.at ? (
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
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

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: 22,
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 18,
    marginVertical: 4,
  },
  body: {
    flex: 1,
    paddingTop: 2,
    gap: 2,
  },
  bodyPad: {
    paddingBottom: 14,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  time: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '400',
  },
});
