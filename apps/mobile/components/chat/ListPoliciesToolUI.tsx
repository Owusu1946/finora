import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ApprovalPolicy } from '@/lib/policies-storage';

type Result = { policies?: ApprovalPolicy[]; simulation?: { requiresApproval: boolean; matched: string[] } };

export const ListPoliciesToolUI = makeAssistantToolUI<
  { amountUsd?: number; isNewRecipient?: boolean },
  Result
>({
  toolName: 'list_policies',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const policies = result?.policies;
    const simulation = result?.simulation;

    if (status.type === 'running' && !policies) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Loading approval policies…
          </Text>
        </View>
      );
    }

    if (!policies?.length) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No approval policies configured.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>Approval policies</Text>
        {policies.map((p) => (
          <View
            key={p.id}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.foreground }]}>{p.name}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{p.rule}</Text>
            </View>
            <Text
              style={[
                styles.badge,
                { color: p.enabled ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {p.enabled ? 'On' : 'Off'}
            </Text>
          </View>
        ))}
        {simulation ? (
          <Text style={[styles.muted, { color: colors.mutedForeground, marginTop: 4 }]}>
            {simulation.requiresApproval
              ? `This action would require approval${
                  simulation.matched.length ? ` (${simulation.matched.join(', ')})` : ''
                }.`
              : 'This action would not hit an enabled policy rule.'}
          </Text>
        ) : null}
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
  badge: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '700' },
});
