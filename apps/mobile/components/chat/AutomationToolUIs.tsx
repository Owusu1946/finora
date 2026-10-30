import type { CreateAutomationInput } from '@finora/shared';

import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createRemoteAutomation, deleteRemoteAutomation } from '@/lib/automations-api';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { automationsChatId, requestOpenThread } from '@/lib/open-thread';
import { useToolCallState } from '@/lib/tool-call-state';

type AutomationSummary = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'disabled';
  description: string;
  lastTriggeredAt?: string | null;
};

function Card({ children }: { children: ReactNode }) {
  return (
    <View
      className='my-2 gap-3 border border-border bg-composer p-4'
      style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
    >
      {children}
    </View>
  );
}

function Title({ title, detail }: { title: string; detail?: string }) {
  return (
    <View className='gap-1'>
      <Text className='font-sans-semibold text-[16px] text-foreground'>{title}</Text>
      {detail ? (
        <Text className='font-sans text-[14px] leading-5 text-muted-foreground'>{detail}</Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  busy,
  tone = 'primary',
  onPress,
}: {
  label: string;
  busy?: boolean;
  tone?: 'primary' | 'secondary' | 'destructive';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole='button'
      disabled={busy}
      onPress={onPress}
      className={cx(
        'min-h-[46px] flex-1 flex-row items-center justify-center gap-2 rounded-full px-3 active:opacity-85 disabled:opacity-60',
        tone === 'primary'
          ? 'bg-foreground'
          : tone === 'destructive'
            ? 'bg-destructive'
            : 'bg-muted',
      )}
    >
      {busy ? (
        <LoadingIcon color={tone === 'secondary' ? colors.foreground : colors.background} />
      ) : null}
      <Text
        className={cx(
          'font-sans-semibold text-[15px]',
          tone === 'secondary' ? 'text-foreground' : 'text-background',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useOpenAutomationsChat() {
  const { userId } = useAuth();
  return () => {
    if (!userId) return;
    haptics.selection();
    requestOpenThread(automationsChatId(userId));
  };
}

/** A drafted automation: nothing runs until the user taps Turn on. */
function AutomationDraftCard({
  toolCallId,
  automation,
  description,
}: {
  toolCallId: string;
  automation: CreateAutomationInput;
  description: string;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [state, setState] = useToolCallState<'created' | 'dismissed'>(
    'automation-draft',
    toolCallId,
  );
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    haptics.selection();
    setBusy(true);
    try {
      await createRemoteAutomation(getToken, automation);
      haptics.success();
      setState('created');
    } catch (error) {
      haptics.error();
      Alert.alert(
        "Couldn't turn it on",
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (state === undefined) return null;
  if (state === 'dismissed') {
    return (
      <Text className='my-1 px-1 font-sans-medium text-[14px] text-muted-foreground'>
        Automation not created.
      </Text>
    );
  }
  const moneyRule = automation.action.type !== 'notify_chat';
  return (
    <Card>
      <Title
        title={state === 'created' ? `${automation.name} is on` : automation.name}
        detail={description}
      />
      {moneyRule ? (
        <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
          When it runs, Finora prepares it in your Automations chat. Nothing moves until you approve
          it with your passcode.
        </Text>
      ) : null}
      <View className='flex-row gap-2'>
        {state === 'created' ? (
          <ActionButton
            label='View automations'
            tone='secondary'
            onPress={() => router.push('/automations')}
          />
        ) : (
          <>
            <ActionButton
              label='Not now'
              tone='secondary'
              onPress={() => setState('dismissed')}
            />
            <ActionButton
              label={busy ? 'Turning on' : 'Turn on'}
              busy={busy}
              onPress={() => void turnOn()}
            />
          </>
        )}
      </View>
    </Card>
  );
}

export const CreateAutomationToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  { status?: 'draft'; automation?: CreateAutomationInput; description?: string }
>({
  toolName: 'create_automation',
  display: 'standalone',
  render: ({ result, toolCallId }) => {
    if (result?.status !== 'draft' || !result.automation) return null;
    return (
      <AutomationDraftCard
        toolCallId={toolCallId}
        automation={result.automation}
        description={result.description ?? ''}
      />
    );
  },
});

function DeleteAutomationCard({
  toolCallId,
  automation,
}: {
  toolCallId: string;
  automation: AutomationSummary;
}) {
  const { getToken } = useAuth();
  const [state, setState] = useToolCallState<'deleted' | 'kept'>('automation-delete', toolCallId);
  const [busy, setBusy] = useState(false);

  if (state === undefined) return null;
  if (state) {
    return (
      <Text className='my-1 px-1 font-sans-medium text-[14px] text-muted-foreground'>
        {state === 'deleted' ? `Deleted "${automation.name}".` : `Kept "${automation.name}".`}
      </Text>
    );
  }
  return (
    <Card>
      <Title
        title={`Delete "${automation.name}"?`}
        detail={automation.description}
      />
      <View className='flex-row gap-2'>
        <ActionButton
          label='Keep it'
          tone='secondary'
          onPress={() => setState('kept')}
        />
        <ActionButton
          label='Delete'
          tone='destructive'
          busy={busy}
          onPress={() => {
            haptics.selection();
            setBusy(true);
            void deleteRemoteAutomation(getToken, automation.id)
              .then(() => {
                haptics.success();
                setState('deleted');
              })
              .catch((error: unknown) =>
                Alert.alert(
                  "Couldn't delete it",
                  error instanceof Error ? error.message : 'Try again.',
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      </View>
    </Card>
  );
}

function RunningCard({ automation }: { automation: AutomationSummary }) {
  const openChat = useOpenAutomationsChat();
  return (
    <Card>
      <Title
        title={`Running "${automation.name}"`}
        detail='The result will appear in your Automations chat in a few seconds.'
      />
      <ActionButton
        label='Open Automations chat'
        tone='secondary'
        onPress={openChat}
      />
    </Card>
  );
}

export const ManageAutomationToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  { ok?: boolean; status?: 'confirm_delete' | 'queued' | 'updated'; automation?: AutomationSummary }
>({
  toolName: 'manage_automation',
  display: 'standalone',
  render: ({ result, toolCallId }) => {
    if (!result?.ok || !result.automation) return null;
    if (result.status === 'confirm_delete') {
      return (
        <DeleteAutomationCard
          toolCallId={toolCallId}
          automation={result.automation}
        />
      );
    }
    if (result.status === 'queued') return <RunningCard automation={result.automation} />;
    return null;
  },
});

/**
 * Posted to the Automations chat when a money rule runs. Tapping Prepare it
 * asks Finora to prepare the action, which then goes through approval.
 */
function AutomationReadyCard({
  toolCallId,
  name,
  description,
  prompt,
}: {
  toolCallId: string;
  name: string;
  description: string;
  prompt: string;
}) {
  const aui = useAui();
  const [state, setState] = useToolCallState<'prepared'>('automation-ready', toolCallId);
  if (state === undefined) return null;
  return (
    <Card>
      <Title
        title={state === 'prepared' ? `${name}: sent to Finora` : `${name} is ready`}
        detail={`Finora will ${description}.`}
      />
      {state === 'prepared' || !prompt ? null : (
        <ActionButton
          label='Prepare it'
          onPress={() => {
            haptics.selection();
            setState('prepared');
            aui.composer.setText(prompt);
            aui.composer.send();
          }}
        />
      )}
    </Card>
  );
}

export const AutomationReadyToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  { name?: string; description?: string; prompt?: string }
>({
  toolName: 'automation_ready',
  display: 'standalone',
  render: ({ result, toolCallId }) => {
    if (!result?.name) return null;
    return (
      <AutomationReadyCard
        toolCallId={toolCallId}
        name={result.name}
        description={result.description ?? ''}
        prompt={result.prompt ?? ''}
      />
    );
  },
});
