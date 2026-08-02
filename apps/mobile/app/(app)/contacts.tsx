import { useState, useMemo } from "react";
import { StyleSheet, Text, View, ScrollView, TextInput, Platform } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";
import { Spacing, Radius } from "@/constants/theme";

import { MOCK_CONTACTS, type Contact } from "@/components/contacts/types";
import { ContactListItem } from "@/components/contacts/ContactListItem";

export default function ContactsScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_CONTACTS;
    return MOCK_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.method.toLowerCase().includes(q) ||
        c.identifier.toLowerCase().includes(q),
    );
  }, [search]);

  /** Favourites first, then alphabetical. */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const favourites = sorted.filter((c) => c.favourite);
  const others = sorted.filter((c) => !c.favourite);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Icon name="contacts" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search contacts…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            {...Platform.select({
              web: { style: [styles.searchInput, { color: colors.foreground, outlineStyle: "none" } as object] },
              default: {},
            })}
          />
        </View>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              {search ? "No contacts match your search" : "No contacts yet"}
            </Text>
          </View>
        ) : (
          <>
            {/* Favourites section */}
            {favourites.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.sectionHeader,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Favourites
                </Text>
                {favourites.map((c, i) => (
                  <ContactListItem
                    key={c.id}
                    contact={c}
                    index={MOCK_CONTACTS.indexOf(c)}
                    isLast={i === favourites.length - 1}
                  />
                ))}
              </View>
            )}

            {/* Others section */}
            {others.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.sectionHeader,
                    { color: colors.mutedForeground },
                  ]}
                >
                  All Contacts
                </Text>
                {others.map((c, i) => (
                  <ContactListItem
                    key={c.id}
                    contact={c}
                    index={MOCK_CONTACTS.indexOf(c)}
                    isLast={i === others.length - 1}
                  />
                ))}
              </View>
            )}
          </>
        )}
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
    alignSelf: "center",
    width: "100%",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
