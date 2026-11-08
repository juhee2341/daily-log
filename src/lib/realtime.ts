import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNAL_EVENT, joinTopic, sessionTopic, type JoinSignal, type SessionSignal } from "@/lib/signals";

async function send(topic: string, payload: SessionSignal | JoinSignal) {
  const admin = createAdminClient();
  const channel = admin.channel(topic);
  try {
    const result = await channel.httpSend(SIGNAL_EVENT, payload);
    // 신호 실패는 치명적이지 않다 (클라이언트에 폴링 폴백이 있음). 기록만 남긴다.
    if (!result.success) console.error({ action: "broadcast", topic, error: result.error });
  } catch (error) {
    console.error({ action: "broadcast", topic, error });
  } finally {
    await admin.removeChannel(channel);
  }
}

export const signalSession = (sessionId: string, signal: SessionSignal) => send(sessionTopic(sessionId), signal);
export const signalJoin = (memberId: string, signal: JoinSignal) => send(joinTopic(memberId), signal);
