import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { StyleSheet, View } from 'react-native';

import type { CalendarMoneyEvent } from '@/lib/calendar-events-storage';

import { CalendarEventCard } from '@/components/chat/CalendarEventCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListCalendarDuesArgs = {
  range?: 'week' | 'month' | 'six_months';
  query?: string;
};

type ListCalendarDuesResult = {
  connected?: boolean;
  events?: CalendarMoneyEvent[];
};

export const ListCalendarDuesToolUI = makeAssistantToolUI<
  ListCalendarDuesArgs,
  ListCalendarDuesResult
>({
  toolName: 'list_calendar_dues',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const events = result?.events;
    const connected = result?.connected;

    if (status.type === 'running' && !events) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Checking Google Calendar…
          </Text>
        </View>
      );
    }

    if (connected === false) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Google Calendar isn’t connected. Open Integrations to connect it, then ask again.
          </Text>
        </View>
      );
    }

    if (!events?.length) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No matching upcoming events were found on your calendars.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <Text style={[styles.stackTitle, { color: colors.mutedForeground }]}>
          {events.length} calendar event{events.length === 1 ? '' : 's'}
        </Text>
        {events.map((event) => (
          <CalendarEventCard
            key={event.id}
            event={event}
          />
        ))}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  preparingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  empty: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  stack: {
    gap: 2,
    marginVertical: 4,
  },
  stackTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: 2,
  },
});
