import type { ReasoningMessagePartComponent } from '@assistant-ui/react-native';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type ReasoningContextValue = {
  open: boolean;
  streaming: boolean;
  onToggle: () => void;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoningContext() {
  const ctx = useContext(ReasoningContext);
  if (!ctx) {
    throw new Error('Reasoning components must be used inside ReasoningRoot');
  }
  return ctx;
}

type ReasoningRootProps = {
  streaming?: boolean;
  /** Opens while streaming by default (chain-of-thought pattern). */
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
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.composer }]}>
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

export function ReasoningTrigger({
  active,
  duration,
}: {
  active?: boolean;
  /** Optional elapsed seconds shown as (Ns). */
  duration?: number;
}) {
  const { colors } = useTheme();
  const { open, onToggle } = useReasoningContext();
  const suffix = typeof duration === 'number' && duration > 0 ? ` (${Math.round(duration)}s)` : '';

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      accessibilityRole='button'
      accessibilityState={{ expanded: open }}
    >
      <Icon
        name='brain'
        size={16}
        color={active ? colors.foreground : colors.mutedForeground}
      />
      <Text
        style={[
          styles.triggerLabel,
          { color: active ? colors.foreground : colors.mutedForeground },
        ]}
      >
        {active ? `Thinking…${suffix}` : `Reasoning${suffix}`}
      </Text>
      <View style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}>
        <Icon
          name='chevron-down'
          size={16}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

export function ReasoningContent({
  children,
  'aria-busy': ariaBusy,
}: {
  children: ReactNode;
  'aria-busy'?: boolean;
}) {
  const { open } = useReasoningContext();
  if (!open) return null;
  return (
    <View
      style={styles.content}
      accessibilityState={{ busy: ariaBusy === true }}
    >
      {children}
    </View>
  );
}

export function ReasoningText({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.textWrap}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export const Reasoning: ReasoningMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  if (!text?.trim()) return null;
  return <Text style={[styles.reasoningText, { color: colors.mutedForeground }]}>{text}</Text>;
};

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  triggerLabel: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  content: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
  },
  textWrap: {
    maxHeight: 200,
  },
  reasoningText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
});
