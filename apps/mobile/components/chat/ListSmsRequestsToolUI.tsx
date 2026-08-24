import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { StyleSheet, View } from 'react-native';

import type { SmsPaymentRequest } from '@/lib/sms-requests-storage';

import { SmsRequestCard } from '@/components/chat/SmsRequestCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListSmsRequestsArgs = {
  status?: 'new' | 'all';
};

type ListSmsRequestsResult = {
  connected?: boolean;
  requests?: SmsPaymentRequest[];
};

export const ListSmsRequestsToolUI = makeAssistantToolUI<
  ListSmsRequestsArgs,
  ListSmsRequestsResult
>({
  toolName: 'list_sms_requests',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const requests = result?.requests;
    const connected = result?.connected;

    if (status.type === 'running' && !requests) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Scanning SMS inbox…
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
            SMS inbox isn’t connected. Open Integrations to connect SMS, then ask again.
          </Text>
        </View>
      );
    }

    if (!requests?.length) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No open payment requests in SMS right now.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <Text style={[styles.stackTitle, { color: colors.mutedForeground }]}>
          {requests.length} SMS payment request{requests.length === 1 ? '' : 's'}
        </Text>
        {requests.map((request) => (
          <SmsRequestCard
            key={request.id}
            request={request}
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
