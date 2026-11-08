import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const HOST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** 현재 기기의 익명 사용자 ID. 아직 발급 전이면 null (읽기 전용 경로용). */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

/**
 * Server Action 전용: 현재 기기의 사용자 ID를 보장한다.
 * 로그인이 없는 서비스라 신원이 없으면 여기서 익명 사용자를 발급하고 쿠키에 저장한다.
 */
export async function requireUser(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub) return data.claims.sub;

  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) {
    throw new AuthError("UNAUTHORIZED", "기기 신원을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }
  return signIn.user.id;
}

/** 해당 세션의 active 멤버인지 확인한다. */
export async function requireMember(sessionId: string): Promise<{ userId: string; member: Tables<"members"> }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new AuthError("UNAUTHORIZED", "세션에 참여한 기기가 아니에요.");

  const { data: member } = await createAdminClient()
    .from("members")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!member) throw new AuthError("NOT_FOUND", "세션을 찾을 수 없거나 참여 중이 아니에요.");
  return { userId, member };
}

/** 방장인지 확인하고, 방장 접속 시각을 갱신한다 (S-6, 최대 1시간에 한 번). */
export async function requireHost(sessionId: string): Promise<{ userId: string; member: Tables<"members"> }> {
  const result = await requireMember(sessionId);
  if (result.member.role !== "host") throw new AuthError("UNAUTHORIZED", "방장만 할 수 있어요.");

  const threshold = new Date(Date.now() - HOST_SEEN_THROTTLE_MS).toISOString();
  await createAdminClient()
    .from("sessions")
    .update({ host_last_seen: new Date().toISOString() })
    .eq("id", sessionId)
    .lt("host_last_seen", threshold);

  return result;
}
