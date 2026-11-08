import "server-only";
import { getRetainedDates } from "@/lib/slot";
import { MEDIA_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_MS, type VlogItem } from "@/lib/vlog";

// 재생·내보내기 동안 끊기지 않도록 넉넉히
const SIGNED_URL_TTL_S = 2 * 60 * 60;

export type VlogData = {
  logDate: string;
  items: VlogItem[];
  /** 그 날 포스트가 있는 멤버 (멤버별 모드 선택지) */
  members: { id: string; nickname: string; count: number }[];
};

/** V-1: 하루치 포스트를 시간순으로. memberId가 있으면 그 멤버만. 호출 전에 requireMember로 권한을 확인한다. */
export async function getVlog(
  sessionId: string,
  day: "today" | "yesterday",
  memberId: string | null,
  now = new Date(),
): Promise<VlogData> {
  const admin = createAdminClient();
  const dates = getRetainedDates(now);
  const logDate = day === "today" ? dates.today : dates.yesterday;

  const [posts, members] = await Promise.all([
    admin
      .from("posts")
      .select("id, member_id, media_type, media_path, duration_ms, caption, slot_start, created_at")
      .eq("session_id", sessionId)
      .eq("log_date", logDate)
      .order("slot_start", { ascending: true })
      .order("created_at", { ascending: true }),
    admin.from("members").select("id, nickname").eq("session_id", sessionId).eq("status", "active"),
  ]);
  if (posts.error) throw posts.error;
  if (members.error) throw members.error;

  const nicknames = new Map(members.data.map((m) => [m.id, m.nickname]));
  const all = posts.data.filter((p) => nicknames.has(p.member_id));
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.member_id, (counts.get(p.member_id) ?? 0) + 1);

  const selected = memberId ? all.filter((p) => p.member_id === memberId) : all;
  const signed = selected.length
    ? await admin.storage.from(MEDIA_BUCKET).createSignedUrls(
        selected.map((p) => p.media_path),
        SIGNED_URL_TTL_S,
      )
    : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  return {
    logDate,
    items: selected.flatMap((p) => {
      const url = urls.get(p.media_path);
      if (!url) return [];
      return [
        {
          id: p.id,
          type: p.media_type,
          url,
          durationMs: p.media_type === "video" ? (p.duration_ms ?? PHOTO_MS) : PHOTO_MS,
          memberId: p.member_id,
          nickname: nicknames.get(p.member_id)!,
          caption: p.caption,
          slotStart: p.slot_start,
        },
      ];
    }),
    members: [...counts.entries()].map(([id, count]) => ({ id, nickname: nicknames.get(id)!, count })),
  };
}
