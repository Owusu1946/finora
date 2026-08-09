import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';
import {
  CreateVirtualCardWizard,
  type CreateVirtualCardSeed,
} from '@/components/chat/CreateVirtualCardWizard';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';

type CreateVirtualCardArgs = CreateVirtualCardSeed;

type CreateVirtualCardResult = {
  status?: 'issued' | 'cancelled';
  card?: VirtualCard;
};

function PreparingCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
    >
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  );
}

function CreateVirtualCardFlow({
  seed,
  onFinished,
  onCancelled,
}: {
  seed: CreateVirtualCardSeed;
  onFinished: (payload: CreateVirtualCardResult & { status: 'issued' }) => void;
  onCancelled: () => void;
}) {
  const aui = useAui();
  const followedUpRef = useRef(false);

  return (
    <CreateVirtualCardWizard
      seed={seed}
      onCancelled={onCancelled}
      onIssued={(card) => {
        onFinished({ status: 'issued', card });
        if (!followedUpRef.current) {
          followedUpRef.current = true;
          appendAgentFollowUp(
            aui,
            `${card.label} card •••• ${card.last4} is ready. Open Cards to reveal details, edit the limit, or freeze it anytime.`,
          );
        }
      }}
    />
  );
}

export const CreateVirtualCardToolUI = makeAssistantToolUI<
  CreateVirtualCardArgs,
  CreateVirtualCardResult
>({
  toolName: 'create_virtual_card',
  display: 'standalone',
  render: ({ args, status, addResult }) => {
    if (status.type === 'running' && args == null) {
      return <PreparingCard />;
    }

    return (
      <CreateVirtualCardFlow
        seed={args ?? {}}
        onFinished={(payload) => addResult(payload)}
        onCancelled={() => addResult({ status: 'cancelled' })}
      />
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
  },
});
