"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireMember } from "@/lib/auth";
import {
  CANCEL_WINDOW_MS,
  MAX_TICKETS_PER_SLOT,
  MEDIA_LIMITS,
  THUMB_MAX_BYTES,
  TICKET_TTL_MS,
  VIDEO_MAX_MS,
  mediaPaths,
  sniffMime,
  type MediaMime,
} from "@/lib/media";
import { signalSession } from "@/lib/realtime";
import { getLogDate, getSlotStart } from "@/lib/slot";
import { MEDIA_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  issueTicketSchema,
  postRefSchema,
  publishPostSchema,
  type IssueTicketInput,
  type PublishPostInput,
} from "@/lib/validators/post.schema";

const UNIQUE_VIOLATION = "23505";

export type CaptureTicket = {
  ticketId: string;
  slotStart: string;
  expiresAt: string;
  media: { path: string; token: string };
  thumb: { path: string; token: string };
};

/**
 * P-4: 셔터를 누른 순간 호출한다. 서버 시각으로 슬롯을 정하고, 업로드용 서명 URL을 발급한다.
 * 클라이언트 시계를 조작해도 지난 슬롯에 올릴 수 없다.
 */
export async function issueCaptureTicket(input: IssueTicketInput): Promise<ActionResult<CaptureTicket>> {
  const parsed = issueTicketSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "지원하지 않는 형식이에요.");
  const { sessionId, mimeType } = parsed.data;

  let member;
  try {
    ({ member } = await requireMember(sessionId));
  } catch (error) {
    return authFailure(error);
  }

  const now = new Date();
  const slotStart = getSlotStart(now).toISOString();
  const admin = createAdminClient();

  const [existing, tickets] = await Promise.all([
    admin.from("posts").select("id").eq("member_id", member.id).eq("slot_start", slotStart).maybeSingle(),
    admin
      .from("capture_tickets")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("slot_start", slotStart),
  ]);
  if (existing.data) return fail("VALIDATION_ERROR", "이번 시간대에는 이미 올렸어요. 다음 정각에 다시 찍어주세요.");
  if ((tickets.count ?? 0) >= MAX_TICKETS_PER_SLOT) {
    return fail("RATE_LIMITED", "이번 시간대에 너무 많이 다시 찍었어요. 다음 정각에 다시 시도해주세요.");
  }

  const postId = randomUUID();
  const paths = mediaPaths(sessionId, member.id, postId, mimeType);
  const expiresAt = new Date(now.getTime() + TICKET_TTL_MS).toISOString();

  const { data: ticket, error } = await admin
    .from("capture_tickets")
    .insert({ member_id: member.id, slot_start: slotStart, post_id: postId, issued_at: now.toISOString(), expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !ticket) {
    console.error({ action: "issueCaptureTicket", sessionId, error });
    return fail("INTERNAL", "촬영 준비에 실패했어요. 다시 시도해주세요.");
  }

  const storage = admin.storage.from(MEDIA_BUCKET);
  const [media, thumb] = await Promise.all([
    storage.createSignedUploadUrl(paths.media),
    storage.createSignedUploadUrl(paths.thumb),
  ]);
  if (media.error || thumb.error) {
    console.error({ action: "issueCaptureTicket.sign", sessionId, error: media.error ?? thumb.error });
    return fail("INTERNAL", "촬영 준비에 실패했어요. 다시 시도해주세요.");
  }

  return ok({
    ticketId: ticket.id,
    slotStart,
    expiresAt,
    media: { path: paths.media, token: media.data.token },
    thumb: { path: paths.thumb, token: thumb.data.token },
  });
}

/** 업로드된 파일의 크기와 실제 형식(매직 바이트)을 확인한다. */
async function verifyObject(path: string, expected: MediaMime | "thumb"): Promise<string | null> {
  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  const { data: info, error } = await storage.info(path);
  if (error || !info) return "업로드된 파일을 찾을 수 없어요. 다시 올려주세요.";

  const maxBytes = expected === "thumb" ? THUMB_MAX_BYTES : MEDIA_LIMITS[expected].maxBytes;
  if (!info.size || info.size > maxBytes) return "파일이 너무 커요.";

  const { data: signed } = await storage.createSignedUrl(path, 60);
  if (!signed) return "업로드된 파일을 확인하지 못했어요.";
  const head = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  const sniffed = sniffMime(new Uint8Array(await head.arrayBuffer()));
  const want = expected === "thumb" ? "image/jpeg" : expected;
  return sniffed === want ? null : "지원하지 않는 파일 형식이에요.";
}

/** P-1~P-4: 업로드를 마친 뒤 게시한다. 티켓 발급(셔터) 후 5분 안에만 가능하다. */
export async function publishPost(input: PublishPostInput): Promise<ActionResult<{ postId: string }>> {
  const parsed = publishPostSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { ticketId, mimeType, caption, durationMs } = parsed.data;
  const kind = MEDIA_LIMITS[mimeType].kind;
  if (kind === "video" && durationMs === undefined) {
    return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", { durationMs: ["영상 길이를 확인할 수 없어요."] });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("capture_tickets")
    .select("id, member_id, slot_start, post_id, expires_at, used")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return fail("NOT_FOUND", "촬영 정보가 없어요. 다시 찍어주세요.");

  const { data: owner } = await admin.from("members").select("session_id").eq("id", ticket.member_id).maybeSingle();
  if (!owner) return fail("NOT_FOUND", "세션을 찾을 수 없어요.");

  let member;
  try {
    ({ member } = await requireMember(owner.session_id));
  } catch (error) {
    return authFailure(error);
  }
  if (member.id !== ticket.member_id) return fail("UNAUTHORIZED", "내 촬영이 아니에요.");
  if (ticket.used) return fail("VALIDATION_ERROR", "이미 올린 촬영이에요.");
  if (new Date(ticket.expires_at) <= new Date()) {
    return fail("VALIDATION_ERROR", "찍은 지 5분이 지나서 올릴 수 없어요. 다시 찍어주세요.");
  }

  const sessionId = owner.session_id;
  const paths = mediaPaths(sessionId, member.id, ticket.post_id, mimeType);
  const problem = (await verifyObject(paths.media, mimeType)) ?? (await verifyObject(paths.thumb, "thumb"));
  if (problem) {
    await admin.storage.from(MEDIA_BUCKET).remove([paths.media, paths.thumb]);
    return fail("VALIDATION_ERROR", problem);
  }

  const { data: claimed } = await admin
    .from("capture_tickets")
    .update({ used: true })
    .eq("id", ticket.id)
    .eq("used", false)
    .select("id");
  if (!claimed?.length) return fail("VALIDATION_ERROR", "이미 올린 촬영이에요.");

  const slotStart = new Date(ticket.slot_start);
  const { error } = await admin.from("posts").insert({
    id: ticket.post_id,
    session_id: sessionId,
    member_id: member.id,
    slot_start: slotStart.toISOString(),
    log_date: getLogDate(slotStart),
    media_type: kind,
    media_path: paths.media,
    thumb_path: paths.thumb,
    mime_type: mimeType,
    // 녹화 종료 지연으로 10초를 살짝 넘길 수 있어 저장값은 상한으로 자른다
    duration_ms: kind === "video" ? Math.min(durationMs!, VIDEO_MAX_MS) : null,
    caption,
  });
  if (error) {
    await admin.storage.from(MEDIA_BUCKET).remove([paths.media, paths.thumb]);
    if (error.code === UNIQUE_VIOLATION) return fail("VALIDATION_ERROR", "이번 시간대에는 이미 올렸어요.");
    console.error({ action: "publishPost", sessionId, error });
    return fail("INTERNAL", "올리지 못했어요. 다시 시도해주세요.");
  }

  await signalSession(sessionId, { type: "post.created" });
  refresh();
  return ok({ postId: ticket.post_id });
}

/** P-5: 게시 후 3분 안에만 올리기 취소. 흔적 없이 삭제되고 같은 슬롯에 다시 올릴 수 있다. */
export async function cancelPost(sessionId: string, postId: string): Promise<ActionResult> {
  const parsed = postRefSchema.safeParse({ sessionId, postId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");

  let member;
  try {
    ({ member } = await requireMember(parsed.data.sessionId));
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - CANCEL_WINDOW_MS).toISOString();
  const { data: removed, error } = await admin
    .from("posts")
    .delete()
    .eq("id", parsed.data.postId)
    .eq("session_id", parsed.data.sessionId)
    .eq("member_id", member.id)
    .gt("created_at", cutoff)
    .select("media_path, thumb_path");
  if (error) {
    console.error({ action: "cancelPost", ...parsed.data, error });
    return fail("INTERNAL", "취소하지 못했어요.");
  }
  if (!removed.length) return fail("NOT_FOUND", "올린 지 3분이 지나서 취소할 수 없어요.");

  await admin.storage
    .from(MEDIA_BUCKET)
    .remove([removed[0].media_path, removed[0].thumb_path])
    .catch((e: unknown) => console.error({ action: "cancelPost.storage", error: e }));
  await signalSession(parsed.data.sessionId, { type: "post.deleted" });
  refresh();
  return ok(undefined);
}
