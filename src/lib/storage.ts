import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "media";
const PAGE = 1000;

/** prefix 아래의 모든 객체 경로를 모은다 (폴더는 재귀). */
async function listAll(prefix: string): Promise<string[]> {
  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      // 폴더 항목은 id가 null
      if (item.id === null) paths.push(...(await listAll(path)));
      else paths.push(path);
    }
    if (data.length < PAGE) return paths;
  }
}

/** `{sessionId}` 또는 `{sessionId}/{memberId}` 아래 미디어를 모두 삭제한다. */
export async function removeMediaPrefix(prefix: string): Promise<void> {
  const paths = await listAll(prefix);
  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await storage.remove(paths.slice(i, i + PAGE));
    if (error) throw error;
  }
}
