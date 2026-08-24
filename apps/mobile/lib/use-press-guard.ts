import { useCallback, useRef } from 'react';

/** Prevents duplicate actions while a navigation or interaction is settling. */
export function usePressGuard(delay = 900) {
  const locked = useRef(false);

  return useCallback(
    (action: () => void) => {
      if (locked.current) return;
      locked.current = true;
      action();
      setTimeout(() => {
        locked.current = false;
      }, delay);
    },
    [delay],
  );
}
