import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/public-env";

/** 매 요청마다 Supabase 세션 토큰을 갱신해 쿠키에 반영한다. 익명 로그인은 여기서 하지 않는다(크롤러 방지). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 토큰 검증 + 필요 시 갱신. 이 호출과 위 createServerClient 사이에 다른 로직을 넣지 않는다.
  await supabase.auth.getClaims();

  return response;
}
