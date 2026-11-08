import "server-only";
import { signalSession } from "@/lib/realtime";
import { getRetainedDates } from "@/lib/slot";
import { listObjects, removeMediaPrefix, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const HOST_INACTIVE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
// 업로드 직후·게시 전 파일을 지우지 않도록, 이보다 오래된 고아 파일만 정리한다
const ORPHAN_GRACE_MS = 60 * 60 * 1000;

export type MaintenanceResult = {
  expiredPosts: number;
  expiredMissions: number;
  destroyedSessions: number;
  removedTickets: number;
  removedTransferCodes: number;
  removedInvites: number;
  removedOrphanFiles: number;
};

/** media/{session}/{member}/{postId}.ext 또는 {postId}_thumb.jpg → postId */
export function postIdFromPath(path: string): string | null {
  const file = path.split("/").pop() ?? "";
  const match = /^([0-9a-f-]{36})(?:_thumb)?\.[a-z0-9]+$/i.exec(file);
  return match ? match[1].toLowerCase() : null;
}

/**
 * 매일 00:05 KST 정리 작업.
 * - D-1: 어제보다 오래된 포스트·미션 삭제 (댓글은 연쇄 삭제, 파일도 삭제)
 * - S-6: 방장이 14일 동안 접속하지 않은 세션 폭파
 * - 만료된 촬영 티켓·옮기기 코드·오래된 초대 링크 정리
 * - DB 행이 없는 고아 파일 정리 (게시 안 된 업로드, 정리 실패분)
 */
export async function runDailyMaintenance(now = new Date()): Promise<MaintenanceResult> {
  const admin = createAdminClient();
  const { yesterday } = getRetainedDates(now);
  const result: MaintenanceResult = {
    expiredPosts: 0,
    expiredMissions: 0,
    destroyedSessions: 0,
    removedTickets: 0,
    removedTransferCodes: 0,
    removedInvites: 0,
    removedOrphanFiles: 0,
  };

  // D-1: 보관 기간이 지난 포스트
  const expired = await admin.from("posts").delete().lt("log_date", yesterday).select("media_path, thumb_path");
  if (expired.error) throw expired.error;
  result.expiredPosts = expired.data.length;
  await removeObjects(expired.data.flatMap((p) => [p.media_path, p.thumb_path]));

  const missions = await admin.from("missions").delete().lt("log_date", yesterday).select("session_id");
  if (missions.error) throw missions.error;
  result.expiredMissions = missions.data.length;

  // S-6: 방장 장기 미접속 세션 폭파
  const inactiveBefore = new Date(now.getTime() - HOST_INACTIVE_DAYS * DAY_MS).toISOString();
  const abandoned = await admin.from("sessions").delete().lt("host_last_seen", inactiveBefore).select("id");
  if (abandoned.error) throw abandoned.error;
  result.destroyedSessions = abandoned.data.length;
  for (const { id } of abandoned.data) {
    await removeMediaPrefix(id);
    await signalSession(id, { type: "session.destroyed" });
  }

  // 만료된 일회성 데이터 (하루 여유)
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  const tickets = await admin.from("capture_tickets").delete().lt("expires_at", dayAgo).select("id");
  if (tickets.error) throw tickets.error;
  result.removedTickets = tickets.data.length;

  const codes = await admin.from("transfer_codes").delete().lt("expires_at", dayAgo).select("code_hash");
  if (codes.error) throw codes.error;
  result.removedTransferCodes = codes.data.length;

  // 초대 링크는 '만료됨' 안내를 위해 만료 후 7일까지 남긴다
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const invites = await admin.from("invites").delete().lt("expires_at", weekAgo).select("id");
  if (invites.error) throw invites.error;
  result.removedInvites = invites.data.length;

  // 고아 파일: 포스트 행이 없고, 만들어진 지 1시간이 지난 파일
  const objects = await listObjects("");
  const ids = [...new Set(objects.map((o) => postIdFromPath(o.path)).filter((id): id is string => !!id))];
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("posts").select("id").in("id", ids.slice(i, i + 200));
    if (error) throw error;
    data.forEach((p) => existing.add(p.id));
  }
  const graceBefore = now.getTime() - ORPHAN_GRACE_MS;
  const orphans = objects.filter((o) => {
    const id = postIdFromPath(o.path);
    const old = o.createdAt ? new Date(o.createdAt).getTime() < graceBefore : true;
    return old && (!id || !existing.has(id));
  });
  await removeObjects(orphans.map((o) => o.path));
  result.removedOrphanFiles = orphans.length;

  return result;
}
