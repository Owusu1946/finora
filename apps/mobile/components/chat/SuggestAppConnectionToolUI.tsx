import type { AppConnectOption } from '@finora/shared';

import { makeAssistantToolUI } from '@assistant-ui/react-native';

import { ConnectOptionsCard } from '@/components/chat/ConnectOptionsCard';

type SuggestAppConnectionArgs = { app?: string; reason?: string };

type SuggestAppConnectionResult = {
  ok: boolean;
  reason?: string;
  connected?: boolean;
  connectOptions?: AppConnectOption[];
};

export const SuggestAppConnectionToolUI = makeAssistantToolUI<
  SuggestAppConnectionArgs,
  SuggestAppConnectionResult
>({
  toolName: 'suggest_app_connection',
  display: 'standalone',
  render: ({ result }) => {
    if (!result?.connectOptions?.length) return null;
    return (
      <ConnectOptionsCard
        options={result.connectOptions}
        reason={result.reason}
        initiallyConnected={result.connected}
      />
    );
  },
});
