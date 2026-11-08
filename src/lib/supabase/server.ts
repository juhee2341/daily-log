import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** 요청 쿠키 기반 클라이언트 (RLS 적용). Server Component에서는 쿠키 쓰기가 무시된다 — 세션 갱신은 proxy가 담당. */
export async function createClient() {
  // 토큰 검증이 Date.now()를 쓰므로 프리렌더가 아닌 요청 시점에만 실행되게 한다 (Cache Components)
  await connection();
  const env = serverEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component 렌더 중에는 쿠키를 쓸 수 없다. Server Action / Route Handler에서는 정상 동작.
        }
      },
    },
  });
}
