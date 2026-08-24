import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import {
  CreateVirtualCardWizard,
  type CreateVirtualCardSeed,
} from '@/components/chat/CreateVirtualCardWizard';
import { LoadingIcon } from '@/components/ui/loading-icon';
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
      className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
      style={[styles.preparing]}
    >
      <LoadingIcon color={colors.mutedForeground} />
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
            `Your ${card.label} card request is confirmed. I’ll let you know when the card details are ready in Cards.`,
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

const styles = {
  preparing: {
    borderRadius: Radius.card,
  },
};
