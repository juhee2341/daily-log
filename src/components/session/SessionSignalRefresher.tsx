"use client";

import { useRouter } from "next/navigation";
import { useSignal } from "@/hooks/use-signal";
import { sessionTopic, type SessionSignal } from "@/lib/signals";

/** 세션 채널 신호를 받으면 서버 데이터로 다시 그린다. 폭파되거나 내가 내보내지면 홈으로 보낸다. */
export function SessionSignalRefresher({ sessionId, myMemberId }: { sessionId: string; myMemberId: string }) {
  const router = useRouter();
  useSignal<SessionSignal>(sessionTopic(sessionId), (signal) => {
    if (signal?.type === "session.destroyed") return router.replace("/?notice=destroyed");
    if (signal?.type === "member.kicked" && signal.memberId === myMemberId) return router.replace("/?notice=kicked");
    router.refresh();
  });
  return null;
}
