"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireHost, requireMember } from "@/lib/auth";
import { signalJoin, signalSession } from "@/lib/realtime";
import { removeMediaPrefix } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { leaveSessionSchema, sessionMemberSchema } from "@/lib/validators/member.schema";

/** I-5: 승인 대기 멤버 승인. */
export async function approveMember(sessionId: string, memberId: string): Promise<ActionResult> {
  const parsed = sessionMemberSchema.safeParse({ sessionId, memberId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  try {
    await requireHost(parsed.data.sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const { data, error } = await createAdminClient()
    .from("members")
    .update({ status: "active", joined_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId)
    .eq("session_id", parsed.data.sessionId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error({ action: "approveMember", ...parsed.data, error });
    return fail("INTERNAL", "승인하지 못했어요.");
  }
  if (!data.length) return fail("NOT_FOUND", "이미 처리된 요청이에요.");

  await Promise.all([
    signalJoin(parsed.data.memberId, { type: "member.approved" }),
    signalSession(parsed.data.sessionId, { type: "member.joined" }),
  ]);
  refresh();
  return ok(undefined);
}

/** I-5: 승인 대기 멤버 거절. 링크는 이미 사용 처리돼 있으므로 소멸되고, 거절 기록을 남긴다. */
export async function rejectMember(sessionId: string, memberId: string): Promise<ActionResult> {
  const parsed = sessionMemberSchema.safeParse({ sessionId, memberId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  try {
    await requireHost(parsed.data.sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const { data: removed, error } = await admin
    .from("members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("session_id", parsed.data.sessionId)
    .eq("status", "pending")
    .select("invite_id, user_id");
  if (error) {
    console.error({ action: "rejectMember", ...parsed.data, error });
    return fail("INTERNAL", "거절하지 못했어요.");
  }
  if (!removed.length) return fail("NOT_FOUND", "이미 처리된 요청이에요.");

  const { invite_id: inviteId, user_id: userId } = removed[0];
  if (inviteId) await recordRejection(inviteId, userId);

  await signalJoin(parsed.data.memberId, { type: "member.rejected" });
  refresh();
  return ok(undefined);
}

/**
 * 같은 기기가 링크를 다시 열면 "거절됨"을 보여주기 위한 기록.
 * 개인 링크는 링크 자체에, 그룹 링크(I-11)는 링크가 계속 쓰이므로 기기별로 남긴다.
 */
async function recordRejection(inviteId: string, userId: string) {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("invites").select("kind").eq("id", inviteId).maybeSingle();
  const { error } =
    invite?.kind === "group"
      ? await admin.from("invite_rejections").upsert({ invite_id: inviteId, user_id: userId }, { ignoreDuplicates: true })
      : await admin.from("invites").update({ rejected_at: new Date().toISOString() }).eq("id", inviteId);
  if (error) console.error({ action: "rejectMember.record", inviteId, error });
}

/** I-7, I-8: 방장이 멤버를 내보낸다. 그 사람의 포스트·댓글·미디어가 모두 삭제된다. */
export async function kickMember(sessionId: string, memberId: string): Promise<ActionResult> {
  const parsed = sessionMemberSchema.safeParse({ sessionId, memberId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  try {
    await requireHost(parsed.data.sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const { data: removed, error } = await createAdminClient()
    .from("members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("session_id", parsed.data.sessionId)
    .eq("role", "member")
    .eq("status", "active")
    .select("id");
  if (error) {
    console.error({ action: "kickMember", ...parsed.data, error });
    return fail("INTERNAL", "내보내지 못했어요.");
  }
  if (!removed.length) return fail("NOT_FOUND", "이미 나간 멤버예요.");

  await cleanupMemberMedia(parsed.data.sessionId, parsed.data.memberId);
  await signalSession(parsed.data.sessionId, { type: "member.kicked", memberId: parsed.data.memberId });
  refresh();
  return ok(undefined);
}

/**
 * I-7, S-4: 세션 나가기.
 * - 멤버: 내 기록을 모두 지우고 나간다.
 * - 방장: 세션 이름을 정확히 입력해야 세션 전체가 폭파된다.
 */
export async function leaveSession(formData: FormData): Promise<ActionResult> {
  const parsed = leaveSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    confirmName: formData.get("confirmName") ?? undefined,
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");
  const { sessionId, confirmName } = parsed.data;

  let member;
  try {
    ({ member } = await requireMember(sessionId));
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();

  if (member.role === "host") {
    const { data: session } = await admin.from("sessions").select("name").eq("id", sessionId).maybeSingle();
    if (!session) return fail("NOT_FOUND", "이미 사라진 세션이에요.");
    if (confirmName?.trim() !== session.name) {
      return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", { confirmName: ["세션 이름이 일치하지 않아요."] });
    }

    const { error } = await admin.from("sessions").delete().eq("id", sessionId);
    if (error) {
      console.error({ action: "leaveSession.destroy", sessionId, error });
      return fail("INTERNAL", "세션을 폭파하지 못했어요.");
    }
    await cleanupMedia(sessionId);
    await signalSession(sessionId, { type: "session.destroyed" });
  } else {
    const { error } = await admin.from("members").delete().eq("id", member.id);
    if (error) {
      console.error({ action: "leaveSession", sessionId, error });
      return fail("INTERNAL", "세션을 나가지 못했어요.");
    }
    await cleanupMemberMedia(sessionId, member.id);
    await signalSession(sessionId, { type: "member.left", memberId: member.id });
  }

  redirect("/");
}

// DB 행은 이미 삭제됐으므로 미디어 정리 실패는 사용자 흐름을 막지 않는다. 남은 파일은 매일 cron이 고아 파일로 정리한다.
async function cleanupMedia(sessionId: string) {
  await removeMediaPrefix(sessionId).catch((error) => console.error({ action: "cleanupMedia", sessionId, error }));
}

async function cleanupMemberMedia(sessionId: string, memberId: string) {
  await removeMediaPrefix(`${sessionId}/${memberId}`).catch((error) =>
    console.error({ action: "cleanupMemberMedia", sessionId, memberId, error }),
  );
}
