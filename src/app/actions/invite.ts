"use server";

import { refresh } from "next/cache";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireHost, requireUser } from "@/lib/auth";
import { generateInviteToken, hashToken } from "@/lib/invite-token";
import { signalSession } from "@/lib/realtime";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInviteSchema, requestJoinSchema, sessionInviteSchema } from "@/lib/validators/member.schema";

const MAX_OPEN_INVITES = 30;
const UNIQUE_VIOLATION = "23505";

/** I-1: 일회용 초대 링크 생성. 원본 링크는 이 응답에서만 받을 수 있다. */
export async function createInvite(formData: FormData): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const parsed = createInviteSchema.safeParse({ sessionId: formData.get("sessionId"), memo: formData.get("memo") });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { sessionId, memo } = parsed.data;

  try {
    await requireHost(sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_OPEN_INVITES) {
    return fail("RATE_LIMITED", `아직 안 쓴 링크가 ${MAX_OPEN_INVITES}개예요. 쓰지 않을 링크를 취소해주세요.`);
  }

  const token = generateInviteToken();
  const { data: invite, error } = await admin
    .from("invites")
    .insert({ session_id: sessionId, token_hash: hashToken(token), memo })
    .select("expires_at")
    .single();
  if (error || !invite) {
    console.error({ action: "createInvite", sessionId, error });
    return fail("INTERNAL", "링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  refresh();
  return ok({ url: `${await getSiteUrl()}/join/${token}`, expiresAt: invite.expires_at });
}

/** I-3: 쓰지 않은 링크 취소. */
export async function revokeInvite(sessionId: string, inviteId: string): Promise<ActionResult> {
  const parsed = sessionInviteSchema.safeParse({ sessionId, inviteId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  try {
    await requireHost(parsed.data.sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const { error } = await createAdminClient()
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", parsed.data.inviteId)
    .eq("session_id", parsed.data.sessionId)
    .eq("status", "open");
  if (error) {
    console.error({ action: "revokeInvite", ...parsed.data, error });
    return fail("INTERNAL", "링크를 취소하지 못했어요.");
  }

  refresh();
  return ok(undefined);
}

/** I-2, I-4: 링크로 닉네임을 제출하면 링크가 사용 처리되고 승인 대기 멤버가 된다. */
export async function requestJoin(formData: FormData): Promise<ActionResult> {
  const parsed = requestJoinSchema.safeParse({ token: formData.get("token"), nickname: formData.get("nickname") });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { token, nickname } = parsed.data;

  let userId: string;
  try {
    userId = await requireUser();
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(token);
  const { data: invite } = await admin.from("invites").select("id, session_id").eq("token_hash", tokenHash).maybeSingle();
  if (!invite) return fail("NOT_FOUND", "유효하지 않은 링크예요.");

  const [mine, sameNickname] = await Promise.all([
    admin.from("members").select("id").eq("session_id", invite.session_id).eq("user_id", userId).maybeSingle(),
    admin.from("members").select("id").eq("session_id", invite.session_id).eq("nickname", nickname).maybeSingle(),
  ]);
  // 이미 이 세션에 참여(또는 대기) 중이면 링크를 소모하지 않는다
  if (mine.data) {
    refresh();
    return ok(undefined);
  }
  if (sameNickname.data) {
    return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", { nickname: ["이 세션에서 이미 쓰는 닉네임이에요."] });
  }

  // 조건부 업데이트로 링크를 원자적으로 차지한다 (동시에 두 명이 눌러도 한 명만 성공)
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("invites")
    .update({ status: "used", used_at: now, used_by: userId })
    .eq("id", invite.id)
    .eq("status", "open")
    .gt("expires_at", now)
    .select("id");
  if (claimError) {
    console.error({ action: "requestJoin.claim", userId, error: claimError });
    return fail("INTERNAL", "참여 요청을 보내지 못했어요.");
  }
  if (!claimed.length) return fail("NOT_FOUND", "이미 사용됐거나 만료된 링크예요.");

  const { error: memberError } = await admin.from("members").insert({
    session_id: invite.session_id,
    user_id: userId,
    invite_id: invite.id,
    nickname,
    role: "member",
    status: "pending",
  });
  if (memberError) {
    await admin.from("invites").update({ status: "open", used_at: null, used_by: null }).eq("id", invite.id);
    if (memberError.code === UNIQUE_VIOLATION) {
      return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", { nickname: ["이 세션에서 이미 쓰는 닉네임이에요."] });
    }
    console.error({ action: "requestJoin.member", userId, error: memberError });
    return fail("INTERNAL", "참여 요청을 보내지 못했어요.");
  }

  await signalSession(invite.session_id, { type: "member.pending" });
  refresh();
  return ok(undefined);
}
