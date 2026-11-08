// 클라이언트에서도 읽는 공개 값. NEXT_PUBLIC_* 은 빌드 시 인라인되므로 직접 참조해야 한다.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};
