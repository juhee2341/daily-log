"use server";

import { refresh } from "next/cache";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireHost, requireUser } from "@/lib/auth";
import { generateInviteToken, hashToken } from "@/lib/invite-token";
import { signalSession } from "@/lib/realtime";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInviteSchema, requestJoinSchema, sessionInviteSchema } from "@/lib/validators/member.schema";
import type { InviteKind } from "@/types/database";

const MAX_OPEN_INVITES = 30;
/** 그룹 링크 하나로 쌓일 수 있는 승인 대기 인원 (링크가 퍼졌을 때 대기 목록이 넘치지 않게) */
const MAX_PENDING_PER_GROUP_INVITE = 50;
const UNIQUE_VIOLATION = "23505";

const NICKNAME_TAKEN = { nickname: ["이 세션에서 이미 쓰는 닉네임이에요."] };

/** I-1, I-11: 초대 링크 생성 (개인 = 1회용, 그룹 = 여러 명). 원본 링크는 이 응답에서만 받을 수 있다. */
export async function createInvite(
  formData: FormData,
): Promise<ActionResult<{ url: string; expiresAt: string; kind: InviteKind }>> {
  const parsed = createInviteSchema.safeParse({
    sessionId: formData.get("sessionId"),
    memo: formData.get("memo"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { sessionId, memo, kind } = parsed.data;

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
    .insert({ session_id: sessionId, token_hash: hashToken(token), memo, kind })
    .select("expires_at")
    .single();
  if (error || !invite) {
    console.error({ action: "createInvite", sessionId, error });
    return fail("INTERNAL", "링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  refresh();
  return ok({ url: `${await getSiteUrl()}/join/${token}`, expiresAt: invite.expires_at, kind });
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
  const { data: invite } = await admin
    .from("invites")
    .select("id, session_id, kind, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
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
  if (sameNickname.data) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", NICKNAME_TAKEN);

  const joined =
    invite.kind === "group"
      ? await joinWithGroupInvite(admin, invite, userId, nickname)
      : await joinWithSingleInvite(admin, invite, userId, nickname);
  if (joined) return joined;

  await signalSession(invite.session_id, { type: "member.pending" });
  refresh();
  return ok(undefined);
}

type Admin = ReturnType<typeof createAdminClient>;
type InviteRow = { id: string; session_id: string; status: string; expires_at: string };

function pendingMember(invite: InviteRow, userId: string, nickname: string) {
  return {
    session_id: invite.session_id,
    user_id: userId,
    invite_id: invite.id,
    nickname,
    role: "member" as const,
    status: "pending" as const,
  };
}

/** I-2: 개인 링크 — 조건부 업데이트로 원자적으로 차지한다 (동시에 두 명이 눌러도 한 명만 성공). 실패 시 결과를, 성공 시 null. */
async function joinWithSingleInvite(admin: Admin, invite: InviteRow, userId: string, nickname: string) {
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

  const { error: memberError } = await admin.from("members").insert(pendingMember(invite, userId, nickname));
  if (memberError) {
    await admin.from("invites").update({ status: "open", used_at: null, used_by: null }).eq("id", invite.id);
    if (memberError.code === UNIQUE_VIOLATION) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", NICKNAME_TAKEN);
    console.error({ action: "requestJoin.member", userId, error: memberError });
    return fail("INTERNAL", "참여 요청을 보내지 못했어요.");
  }
  return null;
}

/** I-11: 그룹 링크 — 링크를 소모하지 않는다. 이 링크로 거절된 기기는 다시 요청할 수 없다. */
async function joinWithGroupInvite(admin: Admin, invite: InviteRow, userId: string, nickname: string) {
  if (invite.status !== "open" || new Date(invite.expires_at) <= new Date()) {
    return fail("NOT_FOUND", "취소됐거나 만료된 링크예요.");
  }

  const [rejection, waiting] = await Promise.all([
    admin.from("invite_rejections").select("invite_id").eq("invite_id", invite.id).eq("user_id", userId).maybeSingle(),
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("invite_id", invite.id)
      .eq("status", "pending"),
  ]);
  if (rejection.data) return fail("UNAUTHORIZED", "방장이 이 기기의 참여 요청을 거절했어요.");
  if ((waiting.count ?? 0) >= MAX_PENDING_PER_GROUP_INVITE) {
    return fail("RATE_LIMITED", "승인을 기다리는 사람이 너무 많아요. 잠시 후 다시 시도해주세요.");
  }

  const { error } = await admin.from("members").insert(pendingMember(invite, userId, nickname));
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // 같은 기기가 두 번 연달아 누른 경우: 먼저 들어간 요청이 있으면 성공으로 본다
      const { data: mine } = await admin
        .from("members")
        .select("id")
        .eq("session_id", invite.session_id)
        .eq("user_id", userId)
        .maybeSingle();
      return mine ? null : fail("VALIDATION_ERROR", "입력값을 확인해주세요.", NICKNAME_TAKEN);
    }
    console.error({ action: "requestJoin.groupMember", userId, error });
    return fail("INTERNAL", "참여 요청을 보내지 못했어요.");
  }
  return null;
}
