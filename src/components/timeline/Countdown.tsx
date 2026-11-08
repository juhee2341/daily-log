"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useNow } from "@/hooks/use-now";

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** target 시각까지 남은 시간(mm:ss). 0이 되면 서버 데이터를 다시 읽는다 (슬롯 전환). */
export function Countdown({ target, prefix, suffix }: { target: string; prefix?: string; suffix?: string }) {
  const router = useRouter();
  const now = useNow();
  const left = now === null ? null : new Date(target).getTime() - now;
  const refreshed = useRef(false);

  useEffect(() => {
    if (left !== null && left <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left, router]);

  return (
    <span className="tabular-nums">
      {prefix}
      {left === null ? "--:--" : format(left)}
      {suffix}
    </span>
  );
}
