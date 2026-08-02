import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

// URL-encoded Gmail SVG with %23 for '#' to ensure cross-platform compatibility
const GMAIL_SVG = `data:image/svg+xml;utf8,<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.58,19.1068l-12.69-8.0757A3,3,0,0,1,7.1109,5.97l9.31,5.9243L24.78,6.0428A3,3,0,0,1,28.22,10.9579Z" fill="%23ea4435"/>
  <path d="M25.5,5.5h4a0,0,0,0,1,0,0v18a3,3,0,0,1-3,3h0a3,3,0,0,1-3-3V7.5a2,2,0,0,1,2-2Z" fill="%2300ac47" transform="translate(53.0001 32.0007) rotate(180)"/>
  <path d="M29.4562,8.0656c-.0088-.06-.0081-.1213-.0206-.1812-.0192-.0918-.0549-.1766-.0823-.2652a2.9312,2.9312,0,0,0-.0958-.2993c-.02-.0475-.0508-.0892-.0735-.1354A2.9838,2.9838,0,0,0,28.9686,6.8c-.04-.0581-.09-.1076-.1342-.1626a3.0282,3.0282,0,0,0-.2455-.2849c-.0665-.0647-.1423-.1188-.2146-.1771a3.02,3.02,0,0,0-.24-.1857c-.0793-.0518-.1661-.0917-.25-.1359-.0884-.0461-.175-.0963-.267-.1331-.0889-.0358-.1837-.0586-.2766-.0859s-.1853-.06-.2807-.0777a3.0543,3.0543,0,0,0-.357-.036c-.0759-.0053-.1511-.0186-.2273-.018a2.9778,2.9778,0,0,0-.4219.0425c-.0563.0084-.113.0077-.1689.0193a33.211,33.211,0,0,0-.5645.178c-.0515.022-.0966.0547-.1465.0795A2.901,2.901,0,0,0,23.5,8.5v5.762l4.72-3.3043a2.8878,2.8878,0,0,0,1.2359-2.8923Z" fill="%23ffba00"/>
  <path d="M5.5,5.5h0a3,3,0,0,1,3,3v18a0,0,0,0,1,0,0h-4a2,2,0,0,1-2-2V8.5a3,3,0,0,1,3-3Z" fill="%234285f4"/>
</svg>`;

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    haptics.selection();
    setIsConnecting(true);
    // Simulate OAuth / Google sign-in consent flow
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      haptics.success();
    }, 1800);
  };

  const handleDisconnect = () => {
    haptics.selection();
    Alert.alert(
      'Disconnect Gmail',
      'Are you sure you want to disconnect your Gmail integration? Finora will stop monitoring your inbox for bills and invoices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setIsConnected(false);
            haptics.light();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Connected Accounts</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Link your accounts so Finora's AI can automatically find and process invoices, bills, and
          transactions.
        </Text>

        {/* Integration Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: GMAIL_SVG }}
                style={styles.gmailLogo}
              />
            </View>

            <View style={styles.meta}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Gmail Inbox</Text>
              <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>
                Scan for invoices, receipts, and payment notifications.
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.cardFooter}>
            <View style={styles.statusSection}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? '#10B981' : colors.mutedForeground },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isConnected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {isConnected ? 'Connected as user@gmail.com' : 'Not connected'}
              </Text>
            </View>

            {isConnecting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size='small'
                  color={colors.primary}
                />
              </View>
            ) : isConnected ? (
              <Pressable
                onPress={handleDisconnect}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnSecondary,
                  { backgroundColor: colors.muted },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.btnTextSecondary, { color: colors.foreground }]}>
                  Disconnect
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleConnect}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Connect</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Security and Trust section */}
        <View style={styles.trustBox}>
          <Icon
            name='shield'
            size={18}
            color={colors.mutedForeground}
          />
          <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
            Finora uses read-only access to search for financial metadata. We never store your
            emails or share your personal data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
    maxWidth: Spacing.threadMaxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
    marginBottom: 8,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  gmailLogo: {
    width: 42,
    height: 42,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
  },
  trustBox: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
