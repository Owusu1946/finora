import type { TextMessagePartComponent } from '@assistant-ui/react-native';

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';

import type { Palette } from '@/constants/theme';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createPaymentAppLink, preparationIdFromUrl } from '@/lib/open-payment-link';

function openLink(url: string) {
  const prep = preparationIdFromUrl(url);
  if (prep) {
    // Prefer in-app deep link so the pay chat flow runs.
    void Linking.openURL(createPaymentAppLink(prep));
    return;
  }
  if (/^https?:\/\//i.test(url)) {
    void WebBrowser.openBrowserAsync(url);
    return;
  }
  void Linking.openURL(url);
}

/** Return false so the library does not also try to open the URL. */
function onLinkPress(url: string) {
  openLink(url);
  return false;
}

function markdownStyles(colors: Palette) {
  const body = {
    color: colors.foreground,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: -0.2,
  } as const;

  return StyleSheet.create({
    body,
    text: body,
    paragraph: {
      ...body,
      marginTop: 0,
      marginBottom: 10,
    },
    heading1: {
      ...body,
      fontFamily: 'DMSans_400Regular',
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 4,
    },
    heading2: {
      ...body,
      fontFamily: 'DMSans_400Regular',
      fontSize: 19,
      lineHeight: 26,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 4,
    },
    heading3: {
      ...body,
      fontFamily: 'DMSans_400Regular',
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '600',
      marginBottom: 4,
      marginTop: 2,
    },
    strong: {
      fontWeight: '700',
      color: colors.foreground,
    },
    em: {
      fontStyle: 'italic',
      color: colors.foreground,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: colors.muted,
      borderColor: colors.border,
      borderLeftWidth: 3,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: Radius.sm,
    },
    code_inline: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 14,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: Radius.sm,
    },
    fence: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    code_block: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: Radius.md,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    list_item: {
      ...body,
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: colors.foreground,
      marginLeft: 4,
      marginRight: 8,
    },
    ordered_list_icon: {
      color: colors.mutedForeground,
      marginLeft: 4,
      marginRight: 8,
    },
    hr: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: 12,
    },
    table: {
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: colors.muted,
    },
    th: {
      ...body,
      fontWeight: '600',
      padding: 8,
      borderColor: colors.border,
    },
    td: {
      ...body,
      padding: 8,
      borderColor: colors.border,
    },
  });
}

export const AssistantMarkdownText: TextMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => markdownStyles(colors), [colors]);

  return (
    <Markdown
      style={styles}
      onLinkPress={onLinkPress}
    >
      {text}
    </Markdown>
  );
};
