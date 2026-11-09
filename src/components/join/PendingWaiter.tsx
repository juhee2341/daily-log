"use client";

import { useRouter } from "next/navigation";
import { useSignal } from "@/hooks/use-signal";
import { joinTopic, type JoinSignal } from "@/lib/signals";

/** 승인/거절 신호를 받으면 서버 상태로 다시 그린다 (승인되면 세션으로 이동). */
export function PendingWaiter({ memberId }: { memberId: string }) {
  const router = useRouter();
  useSignal<JoinSignal>(joinTopic(memberId), () => router.refresh(), 10_000);

  return (
    <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <span className="size-2 animate-pulse rounded-full bg-highlight motion-reduce:animate-none" aria-hidden />
      방장의 승인을 기다리는 중...
    </p>
  );
}
