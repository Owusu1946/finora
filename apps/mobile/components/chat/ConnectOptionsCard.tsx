import type { AppConnectOption } from '@finora/shared';

import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { Fragment, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BusinessAppLogo } from '@/components/integrations/BusinessAppRow';
import { GmailLogo } from '@/components/integrations/gmail-logo';
import { GoogleCalendarLogo } from '@/components/integrations/google-calendar-logo';
import { GoogleDriveLogo } from '@/components/integrations/google-drive-logo';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { connectBusinessApp } from '@/lib/business-apps-api';
import { connectGoogleApp, isGoogleApp } from '@/lib/google-connect';
import { haptics } from '@/lib/haptics';

const LOGO_SIZE = 40;

function OptionLogo({ option }: { option: AppConnectOption }) {
  if (option.kind === 'business') {
    return (
      <BusinessAppLogo
        app={option}
        size={LOGO_SIZE}
      />
    );
  }
  return (
    <View
      className='items-center justify-center rounded-xl border border-border bg-background'
      style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderCurve: 'continuous' }}
    >
      {option.app === 'gmail' ? <GmailLogo width={22} /> : null}
      {option.app === 'googledrive' ? <GoogleDriveLogo /> : null}
      {option.app === 'googlecalendar' ? <GoogleCalendarLogo width={22} /> : null}
    </View>
  );
}

/** Connect an app from chat: Google uses Finora's OAuth, everything else Composio. */
function useConnect(option: AppConnectOption, onConnected: () => void) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (busy) return;
    haptics.selection();
    setBusy(true);
    try {
      const connected = isGoogleApp(option.app)
        ? await connectGoogleApp(getToken, option.app)
        : await connectBusinessApp(getToken, option.app);
      if (connected) {
        haptics.success();
        onConnected();
      }
    } catch (error) {
      haptics.error();
      Alert.alert(
        `Couldn't connect ${option.name}`,
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return { busy, connect };
}

function ConnectButton({
  option,
  compact,
  onConnected,
}: {
  option: AppConnectOption;
  compact: boolean;
  onConnected: () => void;
}) {
  const { colors } = useTheme();
  const { busy, connect } = useConnect(option, onConnected);

  if (!option.connectable) {
    return <Text className='font-sans-medium text-[13px] text-muted-foreground'>Coming soon</Text>;
  }
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={`Connect ${option.name}`}
      disabled={busy}
      onPress={() => void connect()}
      className={
        compact
          ? 'min-h-[34px] flex-row items-center justify-center gap-1.5 rounded-full bg-foreground px-3.5 active:opacity-80 disabled:opacity-60'
          : 'min-h-[46px] flex-row items-center justify-center gap-2 rounded-full bg-foreground px-3 active:opacity-85 disabled:opacity-60'
      }
    >
      {busy ? <LoadingIcon color={colors.background} /> : null}
      <Text
        className={`font-sans-semibold text-background ${compact ? 'text-[13px]' : 'text-[15px]'}`}
      >
        {busy ? 'Connecting' : compact ? 'Connect' : `Connect ${option.name}`}
      </Text>
    </Pressable>
  );
}

/**
 * Shown in chat when a request needs apps the user hasn't connected. One app
 * gets a full card; several (e.g. any payment app) get a list to pick from.
 * Once connected, Continue asks Finora to pick the request back up.
 */
export function ConnectOptionsCard({
  options,
  reason,
  initiallyConnected = false,
}: {
  options: AppConnectOption[];
  reason?: string;
  initiallyConnected?: boolean;
}) {
  const aui = useAui();
  const [connectedName, setConnectedName] = useState<string | null>(
    initiallyConnected ? (options[0]?.name ?? null) : null,
  );
  if (options.length === 0) return null;

  const single = options.length === 1 ? options[0]! : null;
  const title = connectedName
    ? `${connectedName} is connected`
    : single
      ? single.connectable
        ? `Connect ${single.name}`
        : `${single.name} isn't available yet`
      : 'Connect an app to continue';
  const detail = connectedName
    ? 'Finora can use it now.'
    : (reason ??
      (single
        ? single.connectable
          ? `Finora needs ${single.name} for this.`
          : `Finora can't connect ${single.name} yet.`
        : 'Connect any of these and Finora will pick up where it left off.'));

  return (
    <View
      className='my-2 gap-3 border border-border bg-composer p-4'
      style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
    >
      <View className='flex-row items-center gap-3'>
        {single ? <OptionLogo option={single} /> : null}
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[16px] text-foreground'>{title}</Text>
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            {detail}
          </Text>
        </View>
      </View>

      {connectedName ? (
        <Pressable
          accessibilityRole='button'
          onPress={() => {
            haptics.selection();
            aui.composer.setText(`I connected ${connectedName}. Go ahead.`);
            aui.composer.send();
          }}
          className='min-h-[46px] items-center justify-center rounded-full bg-foreground px-3 active:opacity-85'
        >
          <Text className='font-sans-semibold text-[15px] text-background'>Continue</Text>
        </Pressable>
      ) : single ? (
        single.connectable ? (
          <ConnectButton
            option={single}
            compact={false}
            onConnected={() => setConnectedName(single.name)}
          />
        ) : null
      ) : (
        <View>
          {options.map((option, index) => (
            <Fragment key={option.app}>
              {index > 0 ? <View className='h-px bg-border' /> : null}
              <View className='min-h-[56px] flex-row items-center gap-3 py-2'>
                <OptionLogo option={option} />
                <Text
                  className='flex-1 font-sans-semibold text-[15px] text-foreground'
                  numberOfLines={1}
                >
                  {option.name}
                </Text>
                <ConnectButton
                  option={option}
                  compact
                  onConnected={() => setConnectedName(option.name)}
                />
              </View>
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

/** Connect options from a tool result, if it carries any. */
export function connectOptionsFrom(result: unknown): AppConnectOption[] {
  if (typeof result !== 'object' || result === null || !('connectOptions' in result)) return [];
  return Array.isArray(result.connectOptions) ? (result.connectOptions as AppConnectOption[]) : [];
}
