import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | undefined;

/**
 * service role 클라이언트 — RLS 우회. 모든 쓰기는 여기서만, 호출 전 반드시 권한 확인.
 * 사용자 세션을 담지 않으므로 인스턴스 하나를 재사용한다 (요청마다 새로 만들지 않음).
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (client) return client;
  const env = serverEnv();
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
