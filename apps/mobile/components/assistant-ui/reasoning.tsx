import type { ReasoningMessagePartComponent } from '@assistant-ui/react-native';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (streaming) {
      setUserOpen(null);
    }
  }, [streaming]);

  const open = userOpen ?? (streaming || defaultOpen);

  return (
    <View
      className='w-[100%] mb-2.5 border px-3 py-2 border-border bg-composer'
      style={[styles.root]}
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
      className='flex-row items-center gap-2 py-1'
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      accessibilityRole='button'
      accessibilityState={{ expanded: open }}
    >
      <Icon
        name='brain'
        size={16}
        color={active ? colors.foreground : colors.mutedForeground}
      />
      <Text
        className='font-sans-medium flex-1 shrink text-[14px] tracking-[-0.1px]'
        style={[{ color: active ? colors.foreground : colors.mutedForeground }]}
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
      className='mt-1.5 pt-1.5 border-t border-t-[rgba(127,127,127,0.25)]'
      accessibilityState={{ busy: ariaBusy === true }}
    >
      {children}
    </View>
  );
}

export function ReasoningText({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className='max-h-[200px]'
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export const Reasoning: ReasoningMessagePartComponent = ({ text }) => {
  if (!text?.trim()) return null;
  return (
    <Text className='font-sans text-[14px] leading-[19px] tracking-[-0.1px] mb-1 text-muted-foreground'>
      {text}
    </Text>
  );
};

const styles = {
  root: {
    borderRadius: Radius.lg,
  },
};
