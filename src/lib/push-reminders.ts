import "server-only";
import { sendPush } from "@/lib/push";
import { formatKst, getKstHour, getSlotStart, isQuietHour } from "@/lib/slot";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReminderResult = { candidates: number; sent: number; skippedQuiet: number; skippedPosted: number };

/**
 * N-2: 매시 정각 "지금 찍을 시간" 알림.
 * 참여 중인 세션이 있고, 그 세션들 중 이번 슬롯에 아직 안 올린 곳이 있는 사용자에게만 보낸다.
 * 방해금지 시간대(N-3)인 구독은 건너뛴다.
 */
export async function dispatchSlotReminders(now = new Date()): Promise<ReminderResult> {
  const admin = createAdminClient();
  const hour = getKstHour(now);
  const slotStart = getSlotStart(now).toISOString();
  const result: ReminderResult = { candidates: 0, sent: 0, skippedQuiet: 0, skippedPosted: 0 };

  const { data: subs, error } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth, quiet_start, quiet_end");
  if (error) throw error;
  result.candidates = subs.length;
  const awake = subs.filter((s) => !isQuietHour(hour, s.quiet_start, s.quiet_end));
  result.skippedQuiet = subs.length - awake.length;
  if (!awake.length) return result;

  const userIds = [...new Set(awake.map((s) => s.user_id))];
  const { data: members, error: memberError } = await admin
    .from("members")
    .select("id, user_id, session_id")
    .in("user_id", userIds)
    .eq("status", "active");
  if (memberError) throw memberError;
  if (!members.length) return { ...result, skippedPosted: awake.length };

  const [posted, sessions] = await Promise.all([
    admin
      .from("posts")
      .select("member_id")
      .in(
        "member_id",
        members.map((m) => m.id),
      )
      .eq("slot_start", slotStart),
    admin
      .from("sessions")
      .select("id, name")
      .in("id", [...new Set(members.map((m) => m.session_id))]),
  ]);
  if (posted.error) throw posted.error;
  if (sessions.error) throw sessions.error;
  const postedMembers = new Set(posted.data.map((p) => p.member_id));
  const sessionNames = new Map(sessions.data.map((s) => [s.id, s.name]));

  // 사용자별로 아직 안 올린 세션
  const pending = new Map<string, string[]>();
  for (const m of members) {
    if (postedMembers.has(m.id)) continue;
    pending.set(m.user_id, [...(pending.get(m.user_id) ?? []), m.session_id]);
  }

  const label = formatKst(slotStart, "HH:00");
  await Promise.all(
    awake.map(async (sub) => {
      const sessionIds = pending.get(sub.user_id);
      if (!sessionIds?.length) {
        result.skippedPosted += 1;
        return;
      }
      const first = sessionNames.get(sessionIds[0]) ?? "세션";
      const body = sessionIds.length === 1 ? `${first} · ${label}` : `${first} 외 ${sessionIds.length - 1}개 세션 · ${label}`;
      const ok = await sendPush(sub, {
        title: "지금 찍을 시간이에요 📸",
        body,
        url: sessionIds.length === 1 ? `/s/${sessionIds[0]}/capture` : "/",
        tag: `slot-${slotStart}`,
      });
      if (ok) result.sent += 1;
    }),
  );
  return result;
}
