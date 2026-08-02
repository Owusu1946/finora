import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReasoningMessagePartComponent } from "@assistant-ui/react-native";

import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import { haptics } from "@/lib/haptics";

type ReasoningContextValue = {
  open: boolean;
  streaming: boolean;
  onToggle: () => void;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoningContext() {
  const ctx = useContext(ReasoningContext);
  if (!ctx) {
    throw new Error("Reasoning components must be used inside ReasoningRoot");
  }
  return ctx;
}

type ReasoningRootProps = {
  streaming?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function ReasoningRoot({
  streaming = false,
  defaultOpen = false,
  children,
}: ReasoningRootProps) {
  const { colors } = useTheme();
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (streaming) {
      setUserOpen(null);
    }
  }, [streaming]);

  const open = userOpen ?? (streaming || defaultOpen);

  return (
    <View
      style={[
        styles.root,
        { borderColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <ReasoningContext.Provider
        value={{
          open,
          streaming,
          onToggle: () => {
            haptics.selection();
            setUserOpen((prev) => !(prev ?? (streaming || defaultOpen)));
          },
        }}
      >
        {children}
      </ReasoningContext.Provider>
    </View>
  );
}

export function ReasoningTrigger({ active }: { active?: boolean }) {
  const { colors } = useTheme();
  const { open, onToggle } = useReasoningContext();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <Icon name="brain" size={16} color={colors.mutedForeground} />
      <Text
        style={[
          styles.triggerLabel,
          { color: active ? colors.foreground : colors.mutedForeground },
        ]}
      >
        {active ? "Thinking…" : "Reasoning"}
      </Text>
      <View style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }}>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

export function ReasoningContent({ children }: { children: ReactNode }) {
  const { open } = useReasoningContext();
  if (!open) return null;
  return <View style={styles.content}>{children}</View>;
}

export function ReasoningText({ children }: { children: ReactNode }) {
  return <View style={styles.textWrap}>{children}</View>;
}

export const Reasoning: ReasoningMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.reasoningText, { color: colors.mutedForeground }]}>
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  root: {
    width: "100%",
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  triggerLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  content: {
    marginTop: 6,
    paddingTop: 6,
  },
  textWrap: {
    maxHeight: 180,
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
});
