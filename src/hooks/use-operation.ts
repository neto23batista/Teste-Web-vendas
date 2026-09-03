"use client";

import * as React from "react";

/** Synchronous lock: two clicks in the same render cannot start two mutations. */
export function useOperation() {
  const locked = React.useRef(false);
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback((operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    startTransition(async () => {
      try {
        await operation();
      } finally {
        locked.current = false;
      }
    });
  }, []);
  return { pending, run };
}
