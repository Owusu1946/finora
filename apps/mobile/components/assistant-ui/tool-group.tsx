import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type ToolFallbackProps = {
  toolName: string;
  argsText?: string;
  result?: unknown;
  isError?: boolean;
};

type ToolGroupContextValue = {
  open: boolean;
  onToggle: () => void;
};

const ToolGroupContext = createContext<ToolGroupContextValue | null>(null);

function useToolGroupContext() {
  const ctx = useContext(ToolGroupContext);
  if (!ctx) {
    throw new Error('ToolGroup components must be used inside ToolGroupRoot');
  }
  return ctx;
}

export function ToolGroupRoot({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <ToolGroupContext.Provider
      value={{
        open,
        onToggle: () => {
          haptics.selection();
          setOpen((v) => !v);
        },
      }}
    >
      <View style={styles.root}>{children}</View>
    </ToolGroupContext.Provider>
  );
}

export function ToolGroupTrigger({ count, active = false }: { count: number; active?: boolean }) {
  const { colors } = useTheme();
  const { open, onToggle } = useToolGroupContext();
  const label = count === 1 ? '1 tool used' : `${count} tools used`;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      accessibilityRole='button'
      accessibilityState={{ expanded: open }}
    >
      <Icon
        name='tool'
        size={15}
        color={active ? colors.foreground : colors.mutedForeground}
      />
      <Text
        style={[
          styles.triggerLabel,
          { color: active ? colors.foreground : colors.mutedForeground },
        ]}
      >
        {active ? 'Running tools…' : label}
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

export function ToolGroupContent({ children }: { children: ReactNode }) {
  const { open } = useToolGroupContext();
  if (!open) return null;
  return <View style={styles.content}>{children}</View>;
}

export function ToolFallback({ toolName, argsText, result, isError }: ToolFallbackProps) {
  const { colors } = useTheme();
  const done = result !== undefined;

  return (
    <View
      style={[
        styles.toolCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.muted,
        },
      ]}
    >
      <View style={styles.toolHeader}>
        <Icon
          name='tool'
          size={14}
          color={colors.mutedForeground}
        />
        <Text style={[styles.toolName, { color: colors.foreground }]}>{toolName}</Text>
        <Text style={[styles.toolStatus, { color: colors.mutedForeground }]}>
          {isError ? 'failed' : done ? 'done' : 'running'}
        </Text>
      </View>
      {argsText ? (
        <Text
          numberOfLines={3}
          style={[styles.toolMeta, { color: colors.mutedForeground }]}
        >
          {argsText}
        </Text>
      ) : null}
      {done ? (
        <Text
          numberOfLines={4}
          style={[styles.toolMeta, { color: colors.mutedForeground }]}
        >
          {typeof result === 'string' ? result : JSON.stringify(result)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  triggerLabel: {
    flexShrink: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  content: {
    marginTop: 6,
    gap: 6,
  },
  toolCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolName: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  toolStatus: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  toolMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Menlo',
  },
});
