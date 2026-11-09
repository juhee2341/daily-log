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
  | { kind: "open"; sessionName: string; group: boolean };

/** /join/[token] 화면 상태 (I-2~I-5, I-10, I-11). 같은 기기가 다시 열면 이어서 보여준다. */
export async function getJoinState(token: string, userId: string | null, now = new Date()): Promise<JoinState> {
  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("invites")
    .select("id, session_id, kind, status, expires_at, used_by, rejected_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  // 세션이 폭파되면 초대도 연쇄 삭제되므로 여기서 함께 걸린다
  if (!invite) return { kind: "invalid" };

  const group = invite.kind === "group";
  // 세션·내 멤버십·(그룹 링크면) 거절 기록은 서로 독립이라 한 번에 조회한다
  const [sessionResult, memberResult, rejectionResult] = await Promise.all([
    admin.from("sessions").select("id, name").eq("id", invite.session_id).maybeSingle(),
    userId
      ? admin
          .from("members")
          .select("id, status, nickname")
          .eq("session_id", invite.session_id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId && group
      ? admin.from("invite_rejections").select("invite_id").eq("invite_id", invite.id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (sessionResult.error) throw sessionResult.error;
  if (memberResult.error) throw memberResult.error;
  if (rejectionResult.error) throw rejectionResult.error;
  const session = sessionResult.data;
  if (!session) return { kind: "invalid" };

  const member = memberResult.data;
  if (member?.status === "active") return { kind: "member", sessionId: session.id };
  if (member?.status === "pending") {
    return { kind: "pending", sessionName: session.name, nickname: member.nickname, memberId: member.id };
  }
  if (rejectionResult.data) return { kind: "rejected", sessionName: session.name };
  if (userId && invite.used_by === userId && invite.rejected_at) return { kind: "rejected", sessionName: session.name };

  if (invite.status === "revoked") return { kind: "revoked" };
  if (invite.status === "used") return { kind: "used" };
  if (new Date(invite.expires_at) <= now) return { kind: "expired" };
  return { kind: "open", sessionName: session.name, group };
}
