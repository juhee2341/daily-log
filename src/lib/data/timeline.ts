import "server-only";
import { CANCEL_WINDOW_MS } from "@/lib/media";
import { getRetainedDates, getSlotStart } from "@/lib/slot";
import { MEDIA_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaType } from "@/types/database";

const SIGNED_URL_TTL_S = 60 * 60;

export type TimelinePost = {
  id: string;
  memberId: string;
  nickname: string;
  mediaType: MediaType;
  thumbUrl: string | null;
  caption: string | null;
  createdAt: string;
  commentCount: number;
};

export type Timeline = {
  day: "today" | "yesterday";
  logDate: string;
  /** 오늘 탭일 때만: 현재 슬롯과 내가 이미 올렸는지 */
  current: { slotStart: string; posted: boolean } | null;
  slots: { slotStart: string; posts: TimelinePost[] }[];
};

/** P-5: 날짜 탭 안에서 슬롯별(최신이 위) 포스트. 호출 전에 requireMember로 권한을 확인한다. */
export async function getTimeline(
  sessionId: string,
  myMemberId: string,
  day: "today" | "yesterday",
  now = new Date(),
): Promise<Timeline> {
  const admin = createAdminClient();
  const dates = getRetainedDates(now);
  const logDate = day === "today" ? dates.today : dates.yesterday;

  const [posts, members] = await Promise.all([
    admin
      .from("posts")
      .select("id, member_id, slot_start, media_type, thumb_path, caption, created_at")
      .eq("session_id", sessionId)
      .eq("log_date", logDate)
      .order("slot_start", { ascending: false })
      .order("created_at", { ascending: true }),
    admin.from("members").select("id, nickname").eq("session_id", sessionId),
  ]);
  if (posts.error) throw posts.error;
  if (members.error) throw members.error;

  const nicknames = new Map(members.data.map((m) => [m.id, m.nickname]));
  // 썸네일 서명 URL과 댓글 수는 서로 독립이라 함께 요청한다
  const postIds = posts.data.map((p) => p.id);
  const [signed, comments] = postIds.length
    ? await Promise.all([
        admin.storage.from(MEDIA_BUCKET).createSignedUrls(
          posts.data.map((p) => p.thumb_path),
          SIGNED_URL_TTL_S,
        ),
        admin.from("comments").select("post_id").in("post_id", postIds).is("deleted_at", null),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  const thumbUrls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  if (comments.error) throw comments.error;
  const commentCounts = new Map<string, number>();
  for (const c of comments.data) commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);

  const slots = new Map<string, TimelinePost[]>();
  const currentSlot = getSlotStart(now).toISOString();
  if (day === "today") slots.set(currentSlot, []);

  for (const p of posts.data) {
    const key = new Date(p.slot_start).toISOString();
    const list = slots.get(key) ?? [];
    list.push({
      id: p.id,
      memberId: p.member_id,
      nickname: nicknames.get(p.member_id) ?? "알 수 없음",
      mediaType: p.media_type,
      thumbUrl: thumbUrls.get(p.thumb_path) ?? null,
      caption: p.caption,
      createdAt: p.created_at,
      commentCount: commentCounts.get(p.id) ?? 0,
    });
    slots.set(key, list);
  }

  return {
    day,
    logDate,
    current:
      day === "today"
        ? { slotStart: currentSlot, posted: (slots.get(currentSlot) ?? []).some((p) => p.memberId === myMemberId) }
        : null,
    slots: [...slots.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([slotStart, list]) => ({ slotStart, posts: list })),
  };
}

export type PostDetail = {
  id: string;
  nickname: string;
  isMine: boolean;
  mediaType: MediaType;
  mediaUrl: string;
  downloadUrl: string | null;
  caption: string | null;
  slotStart: string;
  createdAt: string;
  durationMs: number | null;
  /** 올리기 취소 가능 마감 시각 (내 포스트이고 아직 3분 안일 때만) */
  cancelUntil: string | null;
};

/** 포스트 상세. 호출 전에 requireMember로 권한을 확인한다. */
export async function getPostDetail(sessionId: string, postId: string, myMemberId: string, now = new Date()) {
  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from("posts")
    .select("id, member_id, media_type, media_path, mime_type, caption, slot_start, created_at, duration_ms")
    .eq("id", postId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!post) return null;

  const isMine = post.member_id === myMemberId;
  const storage = admin.storage.from(MEDIA_BUCKET);
  const [author, media, download] = await Promise.all([
    admin.from("members").select("nickname").eq("id", post.member_id).maybeSingle(),
    storage.createSignedUrl(post.media_path, SIGNED_URL_TTL_S),
    isMine
      ? storage.createSignedUrl(post.media_path, SIGNED_URL_TTL_S, {
          download: `daily-log-${post.id.slice(0, 8)}.${post.media_path.split(".").pop()}`,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (media.error || !media.data) throw media.error ?? new Error("signed url missing");

  const cancelDeadline = new Date(new Date(post.created_at).getTime() + CANCEL_WINDOW_MS);
  return {
    id: post.id,
    nickname: author.data?.nickname ?? "알 수 없음",
    isMine,
    mediaType: post.media_type,
    mediaUrl: media.data.signedUrl,
    downloadUrl: download.data?.signedUrl ?? null,
    caption: post.caption,
    slotStart: post.slot_start,
    createdAt: post.created_at,
    durationMs: post.duration_ms,
    cancelUntil: isMine && cancelDeadline > now ? cancelDeadline.toISOString() : null,
  } satisfies PostDetail;
}

export type PostComment = {
  id: string;
  nickname: string;
  isMine: boolean;
  body: string | null;
  deleted: boolean;
  createdAt: string;
};

/** 포스트 댓글 (오래된 순). 호출 전에 requireMember로 권한을 확인한다. */
export async function getComments(sessionId: string, postId: string, myMemberId: string): Promise<PostComment[]> {
  const admin = createAdminClient();
  const [comments, members] = await Promise.all([
    admin
      .from("comments")
      .select("id, member_id, body, deleted_at, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    admin.from("members").select("id, nickname").eq("session_id", sessionId),
  ]);
  if (comments.error) throw comments.error;
  if (members.error) throw members.error;
  const nicknames = new Map(members.data.map((m) => [m.id, m.nickname]));

  return comments.data.map((c) => ({
    id: c.id,
    nickname: nicknames.get(c.member_id) ?? "알 수 없음",
    isMine: c.member_id === myMemberId,
    body: c.deleted_at ? null : c.body,
    deleted: c.deleted_at !== null,
    createdAt: c.created_at,
  }));
}
