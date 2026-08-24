import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
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
      <View className='w-[100%] mb-2'>{children}</View>
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
      className='flex-row items-center gap-2 py-1'
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      accessibilityRole='button'
      accessibilityState={{ expanded: open }}
    >
      <Icon
        name='tool'
        size={15}
        color={active ? colors.foreground : colors.mutedForeground}
      />
      <Text
        className='font-sans-medium shrink text-[14px] tracking-[-0.1px]'
        style={[{ color: active ? colors.foreground : colors.mutedForeground }]}
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
  return <View className='mt-1.5 gap-1.5'>{children}</View>;
}

export function ToolFallback({ toolName, argsText, result, isError }: ToolFallbackProps) {
  const { colors } = useTheme();
  const done = result !== undefined;

  return (
    <View
      className='border px-2.5 py-2 gap-1 border-border bg-muted'
      style={[styles.toolCard]}
    >
      <View className='flex-row items-center gap-1.5'>
        <Icon
          name='tool'
          size={14}
          color={colors.mutedForeground}
        />
        <Text className='font-sans-semibold flex-1 text-[14px] tracking-[-0.1px] text-foreground'>
          {toolName}
        </Text>
        <Text className='font-sans-medium text-[12px] uppercase text-muted-foreground'>
          {isError ? 'failed' : done ? 'done' : 'running'}
        </Text>
      </View>
      {argsText ? (
        <Text
          numberOfLines={3}
          className='text-[13px] leading-[17px] font-["Menlo"] text-muted-foreground'
        >
          {argsText}
        </Text>
      ) : null}
      {done ? (
        <Text
          numberOfLines={4}
          className='text-[13px] leading-[17px] font-["Menlo"] text-muted-foreground'
        >
          {typeof result === 'string' ? result : JSON.stringify(result)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = {
  toolCard: {
    borderRadius: Radius.md,
  },
};
