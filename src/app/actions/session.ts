"use server";

import { redirect } from "next/navigation";
import { fail, type ActionResult } from "@/lib/action-result";
import { AuthError, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionSchema } from "@/lib/validators/session.schema";

const MAX_SESSIONS_PER_HOUR = 5;

/** S-1 세션 만들기: 세션과 방장 멤버를 만들고 세션 화면으로 이동한다. */
export async function createSession(formData: FormData): Promise<ActionResult> {
  const parsed = createSessionSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  }

  let userId: string;
  try {
    userId = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return fail(error.code, error.message);
    throw error;
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_SESSIONS_PER_HOUR) {
    return fail("RATE_LIMITED", "세션은 1시간에 5개까지 만들 수 있어요.");
  }

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .insert({ name: parsed.data.name, host_user_id: userId })
    .select("id")
    .single();
  if (sessionError || !session) {
    console.error({ userId, action: "createSession", error: sessionError });
    return fail("INTERNAL", "세션을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const { error: memberError } = await admin.from("members").insert({
    session_id: session.id,
    user_id: userId,
    nickname: parsed.data.nickname,
    role: "host",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (memberError) {
    await admin.from("sessions").delete().eq("id", session.id);
    console.error({ userId, action: "createSession.member", error: memberError });
    return fail("INTERNAL", "세션을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  redirect(`/s/${session.id}`);
}
