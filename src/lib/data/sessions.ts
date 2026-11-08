import "server-only";
import { getLogDate } from "@/lib/slot";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole, MemberStatus } from "@/types/database";

export type MySession = {
  id: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  nickname: string;
  memberCount: number;
  todayPostCount: number;
};

/** 홈(S-2): 이 기기가 참여 중이거나 승인 대기 중인 세션 목록. */
export async function getMySessions(userId: string, now = new Date()): Promise<MySession[]> {
  const admin = createAdminClient();

  const { data: memberships, error } = await admin
    .from("members")
    .select("session_id, role, status, nickname, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!memberships.length) return [];

  const sessionIds = memberships.map((m) => m.session_id);
  const activeIds = memberships.filter((m) => m.status === "active").map((m) => m.session_id);

  const [sessions, members, posts] = await Promise.all([
    admin.from("sessions").select("id, name").in("id", sessionIds),
    activeIds.length
      ? admin.from("members").select("session_id").in("session_id", activeIds).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    activeIds.length
      ? admin.from("posts").select("session_id").in("session_id", activeIds).eq("log_date", getLogDate(now))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sessions.error) throw sessions.error;
  if (members.error) throw members.error;
  if (posts.error) throw posts.error;

  const countBy = (rows: { session_id: string }[]) =>
    rows.reduce((acc, row) => acc.set(row.session_id, (acc.get(row.session_id) ?? 0) + 1), new Map<string, number>());
  const memberCounts = countBy(members.data);
  const postCounts = countBy(posts.data);
  const names = new Map(sessions.data.map((s) => [s.id, s.name]));

  return memberships
    .filter((m) => names.has(m.session_id))
    .map((m) => ({
      id: m.session_id,
      name: names.get(m.session_id)!,
      role: m.role,
      status: m.status,
      nickname: m.nickname,
      memberCount: memberCounts.get(m.session_id) ?? 0,
      todayPostCount: postCounts.get(m.session_id) ?? 0,
    }));
}

export type SessionOverview = {
  id: string;
  name: string;
  /** 방장이 마지막으로 들어온 뒤 지난 일수 (S-6 경고용) */
  hostAwayDays: number;
  me: { id: string; nickname: string; role: MemberRole };
  members: { id: string; nickname: string; role: MemberRole }[];
};

/** 세션 화면 상단 정보. 호출 전에 requireMember로 권한을 확인한다. */
export async function getSessionOverview(sessionId: string, myMemberId: string, now = new Date()): Promise<SessionOverview | null> {
  const admin = createAdminClient();
  const [session, members] = await Promise.all([
    admin.from("sessions").select("id, name, host_last_seen").eq("id", sessionId).maybeSingle(),
    admin
      .from("members")
      .select("id, nickname, role")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
  ]);
  if (session.error) throw session.error;
  if (members.error) throw members.error;
  if (!session.data) return null;

  const me = members.data.find((m) => m.id === myMemberId);
  if (!me) return null;
  const hostAwayDays = Math.floor((now.getTime() - new Date(session.data.host_last_seen).getTime()) / (24 * 60 * 60 * 1000));
  return { id: session.data.id, name: session.data.name, hostAwayDays, me, members: members.data };
}
