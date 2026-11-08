"use client";

import { useSyncExternalStore } from "react";

/** 1초마다 갱신되는 현재 시각(ms). 서버 렌더에서는 null. */
function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 1000);
  return () => window.clearInterval(id);
}
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getServerSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
