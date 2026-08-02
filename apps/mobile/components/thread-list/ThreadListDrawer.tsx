import type { DrawerContentComponentProps } from "@react-navigation/drawer";

import {
  ThreadListPrimitive,
  ThreadListItemByIndexProvider,
  useAui,
} from "@assistant-ui/react-native";
import { type Href, usePathname, useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/components/ui/icon-mappings";

import { AccountBadge } from "@/components/shell/account-badge";
import { Icon } from "@/components/ui/icon";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { haptics } from "@/lib/haptics";

import { ThreadListItem } from "./ThreadListItem";

const NAV: { href: Href; label: string; icon: IconName }[] = [
  { href: "/wallets", label: "Wallets", icon: "wallet" },
  { href: "/activity", label: "Activity", icon: "activity" },
  { href: "/contacts", label: "Contacts", icon: "contacts" },
  { href: "/integrations", label: "Integrations", icon: "integrations" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function ThreadListDrawer({ navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.brandRow}>
        <Text style={[styles.brand, { color: colors.foreground }]}>Finora</Text>
        <AccountBadge variant="text" />
      </View>

      <ThreadListPrimitive.Root style={styles.root}>
        <Pressable
          onPressIn={haptics.selection}
          onPress={() => {
            aui.threads.switchToNewThread();
            router.push("/");
            navigation.closeDrawer();
          }}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: pressed ? colors.muted : "transparent" },
          ]}
        >
          <Icon name="compose" size={18} color={colors.foreground} />
          <Text style={[styles.newLabel, { color: colors.foreground }]}>New chat</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Recent</Text>

        <ThreadListPrimitive.Items
          renderItem={({ index }) => (
            <ThreadListItemByIndexProvider index={index} archived={false}>
              <ThreadListItem
                onSelect={() => {
                  router.push("/");
                  navigation.closeDrawer();
                }}
              />
            </ThreadListItemByIndexProvider>
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </ThreadListPrimitive.Root>

      <View
        style={[
          styles.navSection,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {NAV.map((item) => {
          const href = String(item.href);
          const active = pathname.startsWith(href);
          return (
            <Pressable
              key={href}
              onPressIn={haptics.selection}
              onPress={() => {
                router.push(item.href);
                navigation.closeDrawer();
              }}
              style={({ pressed }) => [
                styles.navItem,
                (active || pressed) && { backgroundColor: colors.muted },
              ]}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? colors.foreground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: colors.foreground,
                    fontWeight: active ? "600" : "400",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  brandRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  brand: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  root: {
    flex: 1,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 40,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: Radius.md,
  },
  newLabel: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  navSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  navLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
