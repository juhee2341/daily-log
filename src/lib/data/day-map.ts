import "server-only";
import { getKstHour, getRetainedDates } from "@/lib/slot";
import { createAdminClient } from "@/lib/supabase/admin";

export type DayMap = {
  logDate: string;
  /** 오늘 탭이면 현재 KST 시, 아니면 null */
  currentHour: number | null;
  rows: { memberId: string; nickname: string; isMe: boolean; cells: (string | null)[] }[];
  /** 시간별로 올린 사람 수 */
  totals: number[];
};

/** M-1: 멤버(행) × 0~23시(열). 칸에는 그 시간대 포스트 id. 호출 전에 requireMember로 권한을 확인한다. */
export async function getDayMap(
  sessionId: string,
  myMemberId: string,
  day: "today" | "yesterday",
  now = new Date(),
): Promise<DayMap> {
  const admin = createAdminClient();
  const dates = getRetainedDates(now);
  const logDate = day === "today" ? dates.today : dates.yesterday;

  const [members, posts] = await Promise.all([
    admin
      .from("members")
      .select("id, nickname, role, joined_at")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    admin.from("posts").select("id, member_id, slot_start").eq("session_id", sessionId).eq("log_date", logDate),
  ]);
  if (members.error) throw members.error;
  if (posts.error) throw posts.error;

  const cellOf = new Map<string, (string | null)[]>();
  for (const m of members.data) cellOf.set(m.id, Array<string | null>(24).fill(null));
  const totals = Array<number>(24).fill(0);
  for (const p of posts.data) {
    const hour = getKstHour(new Date(p.slot_start));
    const cells = cellOf.get(p.member_id);
    if (!cells) continue;
    cells[hour] = p.id;
    totals[hour] += 1;
  }

  // 나를 맨 위에, 나머지는 참여 순
  const rows = members.data
    .map((m) => ({ memberId: m.id, nickname: m.nickname, isMe: m.id === myMemberId, cells: cellOf.get(m.id)! }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe));

  return { logDate, currentHour: day === "today" ? getKstHour(now) : null, rows, totals };
}

/** S-7: 해당 날짜의 미션. */
export async function getMission(sessionId: string, logDate: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("missions")
    .select("body")
    .eq("session_id", sessionId)
    .eq("log_date", logDate)
    .maybeSingle();
  if (error) throw error;
  return data?.body ?? null;
}
