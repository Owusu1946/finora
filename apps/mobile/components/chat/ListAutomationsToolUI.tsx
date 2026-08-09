import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Automation } from '@/lib/automations-storage';

type Result = { automations?: Automation[] };

export const ListAutomationsToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_automations',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const automations = result?.automations;

    if (status.type === 'running' && !automations) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Loading automations…
          </Text>
        </View>
      );
    }

    if (!automations?.length) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No automations yet. Rules only prepare actions — money still needs your approval.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {automations.length} automation{automations.length === 1 ? '' : 's'}
        </Text>
        {automations.map((a) => (
          <View
            key={a.id}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.foreground }]}>{a.name}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                When {a.trigger} → {a.action}
              </Text>
            </View>
            <Text
              style={[
                styles.badge,
                { color: a.status === 'active' ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {a.status === 'active' ? 'Active' : 'Paused'}
            </Text>
          </View>
        ))}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  box: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  card: {
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  badge: { fontFamily: 'DMSans_400Regular', fontSize: 12, fontWeight: '700' },
});
