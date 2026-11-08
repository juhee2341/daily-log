"use server";

import { refresh } from "next/cache";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireMember } from "@/lib/auth";
import { signalSession } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCommentSchema, commentRefSchema } from "@/lib/validators/comment.schema";

const MAX_COMMENTS_PER_MINUTE = 20;

/** C-1: 오늘·어제 포스트에 댓글 (100자 이하). */
export async function addComment(formData: FormData): Promise<ActionResult> {
  const parsed = addCommentSchema.safeParse({
    sessionId: formData.get("sessionId"),
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { sessionId, postId, body } = parsed.data;

  let member;
  try {
    ({ member } = await requireMember(sessionId));
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const [post, recent] = await Promise.all([
    admin.from("posts").select("id").eq("id", postId).eq("session_id", sessionId).maybeSingle(),
    admin.from("comments").select("id", { count: "exact", head: true }).eq("member_id", member.id).gte("created_at", since),
  ]);
  if (!post.data) return fail("NOT_FOUND", "사라진 포스트예요.");
  if ((recent.count ?? 0) >= MAX_COMMENTS_PER_MINUTE) return fail("RATE_LIMITED", "잠시 후에 다시 댓글을 달아주세요.");

  const { error } = await admin.from("comments").insert({ post_id: postId, member_id: member.id, body });
  if (error) {
    console.error({ action: "addComment", sessionId, postId, error });
    return fail("INTERNAL", "댓글을 달지 못했어요. 다시 시도해주세요.");
  }

  await signalSession(sessionId, { type: "comment.created", postId });
  refresh();
  return ok(undefined);
}

/** C-2: 내 댓글 삭제. 내용은 지우고 "삭제된 댓글입니다" 흔적을 남긴다. */
export async function deleteComment(sessionId: string, commentId: string): Promise<ActionResult> {
  const parsed = commentRefSchema.safeParse({ sessionId, commentId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  let member;
  try {
    ({ member } = await requireMember(parsed.data.sessionId));
  } catch (error) {
    return authFailure(error);
  }

  const { data, error } = await createAdminClient()
    .from("comments")
    .update({ body: null, deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.commentId)
    .eq("member_id", member.id)
    .is("deleted_at", null)
    .select("post_id");
  if (error) {
    console.error({ action: "deleteComment", ...parsed.data, error });
    return fail("INTERNAL", "댓글을 삭제하지 못했어요.");
  }
  if (!data.length) return fail("NOT_FOUND", "이미 삭제됐거나 내 댓글이 아니에요.");

  await signalSession(parsed.data.sessionId, { type: "comment.deleted", postId: data[0].post_id });
  refresh();
  return ok(undefined);
}
