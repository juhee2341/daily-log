"use client";

import { useEffect, useEffectEvent } from "react";
import { SIGNAL_EVENT } from "@/lib/signals";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime 채널의 변경 신호를 구독한다 (외부 시스템 동기화라 useEffect 사용).
 * 신호를 놓쳐도 화면이 굳지 않도록 `pollMs` 간격으로도 onSignal(null)을 부른다.
 */
export function useSignal<T>(topic: string, onSignal: (signal: T | null) => void, pollMs = 30_000) {
  const handle = useEffectEvent(onSignal);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => handle(payload as T))
      .subscribe();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") handle(null);
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") handle(null);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [topic, pollMs]);
}
