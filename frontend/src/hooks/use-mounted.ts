"use client";

import { useSyncExternalStore, useCallback } from "react";

const emptySubscribe = () => () => {};

export function useMounted() {
  const getSnapshot = useCallback(() => true, []);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}
