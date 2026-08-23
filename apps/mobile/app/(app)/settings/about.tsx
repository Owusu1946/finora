import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

import { SettingsScreen } from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const APP_VERSION = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.1.0';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is Finora?',
    a: 'Finora is ChatGPT for money. Talk in chat to check balances, send and receive, convert FX, and prepare payments.',
  },
  {
    q: 'Does Finora move money on its own?',
    a: 'No. Money only settles after you confirm with your Approvals passcode.',
  },
  {
    q: 'What about agents and MCP?',
    a: 'Agents can use the same capabilities over MCP. Settlement still waits for your approval.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Demo data and preferences stay on this device for now. Live banking will go through Finora’s API — never from the app straight to WeWire.',
  },
];

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View className='px-3.5'>
      <Pressable
        onPress={() => {
          haptics.selection();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        className='flex-row items-center gap-3 py-3.5'
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className='flex-1 font-sans-semibold text-base tracking-[-0.2px] text-foreground'>
          {q}
        </Text>
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <Text className='pb-3.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          {a}
        </Text>
      ) : null}
    </View>
  );
}

export default function AboutFinoraScreen() {
  const [openId, setOpenId] = useState<number | null>(0);

  return (
    <SettingsScreen>
      <View className='mb-1 gap-1.5'>
        <Text className='font-sans text-[29px] font-bold tracking-[-0.6px] text-foreground'>
          About Finora
        </Text>
        <Text className='font-sans-medium text-[15px] text-muted-foreground'>
          ChatGPT for money · v{APP_VERSION}
        </Text>
      </View>

      <View className='overflow-hidden rounded-[26px] border border-border bg-composer'>
        {FAQS.map((item, index) => (
          <View
            key={item.q}
            className={index < FAQS.length - 1 ? 'border-b border-border' : undefined}
          >
            <FaqItem
              q={item.q}
              a={item.a}
              open={openId === index}
              onToggle={() => setOpenId((cur) => (cur === index ? null : index))}
            />
          </View>
        ))}
      </View>

      <View className='mt-2 flex-row items-center justify-center gap-2.5'>
        <Pressable
          onPress={() => {
            haptics.selection();
            void Linking.openURL('https://finora.app/privacy');
          }}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text className='font-sans-medium text-[15px] text-muted-foreground'>Privacy</Text>
        </Pressable>
        <Text className='font-sans text-[15px] text-border'>·</Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            void Linking.openURL('https://finora.app/terms');
          }}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text className='font-sans-medium text-[15px] text-muted-foreground'>Terms</Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}
