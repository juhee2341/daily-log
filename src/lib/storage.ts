import "server-only";
import { MEDIA_BUCKET } from "@/lib/storage-bucket";
import { createAdminClient } from "@/lib/supabase/admin";

export { MEDIA_BUCKET };
const PAGE = 1000;

export type StoredObject = { path: string; createdAt: string | null };

/** prefix 아래의 모든 객체를 모은다 (폴더는 재귀). prefix가 ""이면 버킷 전체. */
export async function listObjects(prefix: string): Promise<StoredObject[]> {
  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  const objects: StoredObject[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // 폴더 항목은 id가 null
      if (item.id === null) objects.push(...(await listObjects(path)));
      else objects.push({ path, createdAt: item.created_at ?? null });
    }
    if (data.length < PAGE) return objects;
  }
}

/** 여러 경로를 1000개 단위로 나눠 삭제한다. */
export async function removeObjects(paths: string[]): Promise<void> {
  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await storage.remove(paths.slice(i, i + PAGE));
    if (error) throw error;
  }
}

/** `{sessionId}` 또는 `{sessionId}/{memberId}` 아래 미디어를 모두 삭제한다. */
export async function removeMediaPrefix(prefix: string): Promise<void> {
  await removeObjects((await listObjects(prefix)).map((o) => o.path));
}
