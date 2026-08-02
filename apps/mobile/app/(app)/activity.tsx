import { useState, useMemo } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

import {
  MOCK_TRANSACTIONS,
  type ActivityFilter,
  type Transaction,
} from "@/components/activity/types";
import { ActivityFilterTabs } from "@/components/activity/ActivityFilterTabs";
import { ActivityListItem } from "@/components/activity/ActivityListItem";

/**
 * Group transactions by relative date label.
 */
function groupByDate(txs: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups: Map<string, Transaction[]> = new Map();

  for (const tx of txs) {
    const d = new Date(tx.timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    let label: string;
    if (isToday) {
      label = "Today";
    } else if (isYesterday) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(tx);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

export default function ActivityScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return MOCK_TRANSACTIONS;
    return MOCK_TRANSACTIONS.filter((tx) => tx.direction === filter);
  }, [filter]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Filter tabs */}
        <ActivityFilterTabs filter={filter} onSelectFilter={setFilter} />

        {/* Transaction list grouped by date */}
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No transactions yet
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.label}>
              <Text
                style={[styles.sectionHeader, { color: colors.mutedForeground }]}
              >
                {section.label}
              </Text>
              {section.items.map((tx, i) => (
                <ActivityListItem
                  key={tx.id}
                  tx={tx}
                  isLast={i === section.items.length - 1}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
    maxWidth: Spacing.threadMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
