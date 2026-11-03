import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'finora.tool-call-state.';

/**
 * Remembers what the user did with a chat card (turned it on, deleted, prepared)
 * so a reloaded chat shows the outcome instead of offering the action again.
 * `undefined` while loading, `null` when nothing was recorded.
 */
export function useToolCallState<T extends string>(namespace: string, toolCallId: string) {
  const key = `${PREFIX}${namespace}.${toolCallId}`;
  const [state, setState] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .catch(() => null)
      .then((value) => {
        if (active) setState((value as T | null) ?? null);
      });
    return () => {
      active = false;
    };
  }, [key]);

  const save = useCallback(
    (value: T) => {
      setState(value);
      void AsyncStorage.setItem(key, value).catch(() => undefined);
    },
    [key],
  );

  return [state, save] as const;
}
