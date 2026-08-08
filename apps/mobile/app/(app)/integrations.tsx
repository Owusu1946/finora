import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  connectGmail,
  disconnectGmail,
  getIntegrations,
  type IntegrationsState,
} from '@/lib/integrations-storage';
import { listDueInvoices } from '@/lib/invoices-storage';

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [state, setState] = useState<IntegrationsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  const refresh = useCallback(async () => {
    const [integrations, due] = await Promise.all([getIntegrations(), listDueInvoices()]);
    setState(integrations);
    setDueCount(due.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!state) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Integrations</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Connect tools so Finora can find supplier invoices and bills for you.
      </Text>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <Icon
              name='integrations'
              size={18}
              color={colors.foreground}
            />
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Gmail</Text>
            <Text style={[styles.cardDetail, { color: colors.mutedForeground }]}>
              {state.gmailConnected
                ? `Connected as ${state.gmailEmail ?? 'account'}`
                : 'Find unpaid invoices from suppliers'}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: state.gmailConnected ? '#10B981' : colors.border },
            ]}
          />
        </View>

        {state.gmailConnected ? (
          <View style={styles.connectedBody}>
            <Text style={[styles.found, { color: colors.foreground }]}>
              {dueCount} unpaid invoice{dueCount === 1 ? '' : 's'} ready to review
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push('/');
                  aui.composer.setText('Find unpaid invoices from suppliers');
                  aui.composer.send();
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  {
                    backgroundColor: colors.foreground,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={async () => {
                  haptics.selection();
                  setBusy(true);
                  setState(await disconnectGmail());
                  setBusy(false);
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnGhost,
                  { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.btnLabel, { color: colors.foreground }]}>Disconnect</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              In chat, say “Find unpaid invoices” or open Invoices in the drawer.
            </Text>
          </View>
        ) : (
          <Pressable
            disabled={busy}
            onPress={async () => {
              haptics.impact();
              setBusy(true);
              await new Promise((r) => setTimeout(r, 700));
              setState(await connectGmail());
              setBusy(false);
              haptics.success();
            }}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              {
                backgroundColor: colors.foreground,
                opacity: pressed || busy ? 0.85 : 1,
                marginTop: 4,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>
              {busy ? 'Connecting…' : 'Connect Gmail'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 18,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  cardDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedBody: {
    gap: 12,
  },
  found: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnPrimary: {},
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
});
