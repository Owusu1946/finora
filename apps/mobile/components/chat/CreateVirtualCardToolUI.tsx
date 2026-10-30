import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRef } from 'react';
import { View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { formatCardAmount } from '@/components/cards/types';
import {
  CreateVirtualCardWizard,
  type CreateVirtualCardSeed,
} from '@/components/chat/CreateVirtualCardWizard';
import { cardForChat, IssuedVirtualCard } from '@/components/chat/IssuedVirtualCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
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
        // The result is saved in chat history and read by the model: never include card secrets.
        onFinished({ status: 'issued', card: cardForChat(card) });
        if (!followedUpRef.current) {
          followedUpRef.current = true;
          appendAgentFollowUp(
            aui,
            `Your ${card.label} card is ready with ${formatCardAmount(card.spendLimit, 'USD')} loaded. Reveal its details from the card whenever you need them.`,
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
  render: ({ args, result, status, addResult }) => {
    if (status.type === 'running' && args == null) {
      return <PreparingCard />;
    }
    // Reloaded history: show what happened instead of reopening setup.
    if (result?.status === 'issued' && result.card) {
      return <IssuedVirtualCard card={result.card} />;
    }
    if (result?.status === 'cancelled') {
      return (
        <Text className='my-1 px-1 font-sans-medium text-[14px] text-muted-foreground'>
          Card setup cancelled.
        </Text>
      );
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
