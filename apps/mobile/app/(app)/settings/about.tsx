import { AppText as Text } from '@/components/ui/text';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  Linking,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';

import { SettingsScreen } from '@/components/settings/SettingsPrimitives';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
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
    <View style={[styles.faqItem, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => {
          haptics.selection();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        style={({ pressed }) => [styles.faqHeader, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.faqQ, { color: colors.foreground }]}>{q}</Text>
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{a}</Text> : null}
    </View>
  );
}

export default function AboutFinoraScreen() {
  const { colors } = useTheme();
  const [openId, setOpenId] = useState<number | null>(0);

  return (
    <SettingsScreen>
      <View style={styles.intro}>
        <Text style={[styles.title, { color: colors.foreground }]}>About Finora</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          ChatGPT for money · v{APP_VERSION}
        </Text>
      </View>

      <View
        style={[styles.faqCard, { backgroundColor: colors.composer, borderColor: colors.border }]}
      >
        {FAQS.map((item, index) => (
          <View
            key={item.q}
            style={
              index < FAQS.length - 1
                ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                : undefined
            }
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

      <View style={styles.links}>
        <Pressable
          onPress={() => {
            haptics.selection();
            void Linking.openURL('https://finora.app/privacy');
          }}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={[styles.link, { color: colors.mutedForeground }]}>Privacy</Text>
        </Pressable>
        <Text style={[styles.dot, { color: colors.border }]}>·</Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            void Linking.openURL('https://finora.app/terms');
          }}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={[styles.link, { color: colors.mutedForeground }]}>Terms</Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
  faqCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  faqItem: {
    paddingHorizontal: 14,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  faqQ: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  faqA: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    paddingBottom: 14,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  link: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
  dot: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
});
