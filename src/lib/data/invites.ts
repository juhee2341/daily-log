import "server-only";
import { hashToken } from "@/lib/invite-token";
import { createAdminClient } from "@/lib/supabase/admin";

export type JoinState =
  | { kind: "invalid" }
  | { kind: "revoked" }
  | { kind: "expired" }
  | { kind: "used" }
  | { kind: "rejected"; sessionName: string }
  | { kind: "pending"; sessionName: string; nickname: string; memberId: string }
  | { kind: "member"; sessionId: string }
  | { kind: "open"; sessionName: string };

/** /join/[token] 화면 상태 (I-2~I-5, I-10). 같은 기기가 다시 열면 이어서 보여준다. */
export async function getJoinState(token: string, userId: string | null, now = new Date()): Promise<JoinState> {
  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("invites")
    .select("id, session_id, status, expires_at, used_by, rejected_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  // 세션이 폭파되면 초대도 연쇄 삭제되므로 여기서 함께 걸린다
  if (!invite) return { kind: "invalid" };

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, name")
    .eq("id", invite.session_id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return { kind: "invalid" };

  if (userId) {
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, status, nickname")
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (member?.status === "active") return { kind: "member", sessionId: session.id };
    if (member?.status === "pending") {
      return { kind: "pending", sessionName: session.name, nickname: member.nickname, memberId: member.id };
    }
    if (invite.used_by === userId && invite.rejected_at) return { kind: "rejected", sessionName: session.name };
  }

  if (invite.status === "revoked") return { kind: "revoked" };
  if (invite.status === "used") return { kind: "used" };
  if (new Date(invite.expires_at) <= now) return { kind: "expired" };
  return { kind: "open", sessionName: session.name };
}
