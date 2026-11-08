import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole } from "@/types/database";

export type MembersPageData = {
  sessionName: string;
  members: { id: string; nickname: string; role: MemberRole }[];
  // 방장에게만 채워진다
  pending: { id: string; nickname: string; memo: string | null; inviteCreatedAt: string | null }[];
  invites: { id: string; memo: string | null; createdAt: string; expiresAt: string }[];
};

/** 멤버 화면 데이터. 호출 전에 requireMember로 권한을 확인한다. */
export async function getMembersPageData(sessionId: string, isHost: boolean, now = new Date()): Promise<MembersPageData | null> {
  const admin = createAdminClient();
  const [session, members] = await Promise.all([
    admin.from("sessions").select("name").eq("id", sessionId).maybeSingle(),
    admin
      .from("members")
      .select("id, nickname, role, status, invite_id, created_at, joined_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  ]);
  if (session.error) throw session.error;
  if (members.error) throw members.error;
  if (!session.data) return null;

  const active = members.data
    .filter((m) => m.status === "active")
    .map(({ id, nickname, role }) => ({ id, nickname, role }));
  if (!isHost) return { sessionName: session.data.name, members: active, pending: [], invites: [] };

  const { data: invites, error } = await admin
    .from("invites")
    .select("id, memo, status, created_at, expires_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const inviteById = new Map(invites.map((i) => [i.id, i]));

  return {
    sessionName: session.data.name,
    members: active,
    pending: members.data
      .filter((m) => m.status === "pending")
      .map((m) => {
        const invite = m.invite_id ? inviteById.get(m.invite_id) : undefined;
        return { id: m.id, nickname: m.nickname, memo: invite?.memo ?? null, inviteCreatedAt: invite?.created_at ?? null };
      }),
    invites: invites
      .filter((i) => i.status === "open" && new Date(i.expires_at) > now)
      .map((i) => ({ id: i.id, memo: i.memo, createdAt: i.created_at, expiresAt: i.expires_at })),
  };
}
