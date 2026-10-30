import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppConnectCard } from '@/components/chat/SuggestAppConnectionToolUI';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendWhatsAppMessage } from '@/lib/business-apps-api';
import { haptics } from '@/lib/haptics';

type DraftArgs = { to?: string; text?: string; customerName?: string };

type DraftResult = {
  status: 'draft' | 'not_connected';
  to: string;
  text: string;
  customerName?: string;
};

const WHATSAPP_LOGO = 'https://logos.composio.dev/api/whatsapp';

/** Remembers which drafts were sent, so a reloaded chat never offers to send twice. */
function sentKey(toolCallId: string) {
  return `finora.whatsapp-sent.${toolCallId}`;
}

function WhatsAppDraftCard({ toolCallId, draft }: { toolCallId: string; draft: DraftResult }) {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const [text, setText] = useState(draft.text);
  const [sent, setSent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(sentKey(toolCallId))
      .catch(() => null)
      .then((value) => {
        if (active) setSent(value === '1');
      });
    return () => {
      active = false;
    };
  }, [toolCallId]);

  const send = async () => {
    if (busy || !text.trim()) return;
    haptics.selection();
    setBusy(true);
    try {
      await sendWhatsAppMessage(getToken, { to: draft.to, text: text.trim() });
      await AsyncStorage.setItem(sentKey(toolCallId), '1').catch(() => undefined);
      haptics.success();
      setSent(true);
    } catch (error) {
      haptics.error();
      Alert.alert(
        "Couldn't send on WhatsApp",
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const recipient = draft.customerName ? `${draft.customerName} · ${draft.to}` : draft.to;

  return (
    <View
      className='my-2 gap-3 border border-border bg-composer p-4'
      style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
    >
      <View className='gap-0.5'>
        <Text className='font-sans-semibold text-[16px] text-foreground'>
          {sent ? 'Sent on WhatsApp' : 'WhatsApp draft'}
        </Text>
        <Text className='font-sans text-[13px] text-muted-foreground'>To {recipient}</Text>
      </View>
      {sent ? (
        <Text className='font-sans text-[15px] leading-[21px] text-foreground'>{text}</Text>
      ) : (
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1_000}
          editable={!busy && sent === false}
          className='min-h-[88px] rounded-[18px] border border-border bg-background px-3.5 py-3 font-sans text-[15px] leading-[21px] text-foreground'
          style={{ borderCurve: 'continuous', textAlignVertical: 'top' }}
        />
      )}
      {sent === false ? (
        <Pressable
          accessibilityRole='button'
          disabled={busy || !text.trim()}
          onPress={() => void send()}
          className='min-h-[46px] flex-row items-center justify-center gap-2 rounded-full bg-foreground px-3 active:opacity-85 disabled:opacity-50'
        >
          {busy ? <LoadingIcon color={colors.background} /> : null}
          <Text className='font-sans-semibold text-[15px] text-background'>
            {busy ? 'Sending' : 'Send on WhatsApp'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const DraftWhatsAppMessageToolUI = makeAssistantToolUI<DraftArgs, DraftResult>({
  toolName: 'draft_whatsapp_message',
  display: 'standalone',
  render: ({ result, toolCallId }) => {
    if (!result) return null;
    if (result.status === 'not_connected') {
      return (
        <AppConnectCard
          app='whatsapp'
          name='WhatsApp Business'
          logo={WHATSAPP_LOGO}
          reason='Connect your WhatsApp Business number to send this message.'
          initiallyConnected={false}
        />
      );
    }
    return (
      <WhatsAppDraftCard
        toolCallId={toolCallId}
        draft={result}
      />
    );
  },
});
