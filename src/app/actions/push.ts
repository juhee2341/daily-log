"use server";

import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { endpointSchema, quietHoursSchema, savePushSchema } from "@/lib/validators/push.schema";

/** N-1: 이 기기의 푸시 구독을 저장한다 (같은 엔드포인트면 갱신). */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const parsed = savePushSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "알림 설정 정보를 확인하지 못했어요.");

  let userId: string;
  try {
    userId = await requireUser();
  } catch (error) {
    return authFailure(error);
  }

  const { endpoint, keys, quietStart, quietEnd } = parsed.data;
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, quiet_start: quietStart, quiet_end: quietEnd },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error({ userId, action: "savePushSubscription", error });
    return fail("INTERNAL", "알림을 켜지 못했어요. 다시 시도해주세요.");
  }
  return ok(undefined);
}

/** 알림 끄기: 내 구독만 지운다. */
export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");
  const userId = await getCurrentUserId();
  if (!userId) return fail("UNAUTHORIZED", "기기 정보를 찾을 수 없어요.");

  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", parsed.data).eq("user_id", userId);
  return ok(undefined);
}

/** N-3: 방해금지 시간대 변경. */
export async function updateQuietHours(endpoint: string, quietStart: number, quietEnd: number): Promise<ActionResult> {
  const parsedEndpoint = endpointSchema.safeParse(endpoint);
  const parsedHours = quietHoursSchema.safeParse({ quietStart, quietEnd });
  if (!parsedEndpoint.success || !parsedHours.success) return fail("VALIDATION_ERROR", "잘못된 시간이에요.");
  const userId = await getCurrentUserId();
  if (!userId) return fail("UNAUTHORIZED", "기기 정보를 찾을 수 없어요.");

  const { data, error } = await createAdminClient()
    .from("push_subscriptions")
    .update({ quiet_start: parsedHours.data.quietStart, quiet_end: parsedHours.data.quietEnd })
    .eq("endpoint", parsedEndpoint.data)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail("INTERNAL", "저장하지 못했어요.");
  if (!data.length) return fail("NOT_FOUND", "알림이 켜져 있지 않아요.");
  return ok(undefined);
}

/** 설정 화면의 '테스트 알림': 이 기기로만 보낸다. */
export async function sendTestPush(endpoint: string): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return fail("VALIDATION_ERROR", "잘못된 요청이에요.");
  const userId = await getCurrentUserId();
  if (!userId) return fail("UNAUTHORIZED", "기기 정보를 찾을 수 없어요.");

  const { data: sub } = await createAdminClient()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("endpoint", parsed.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return fail("NOT_FOUND", "알림이 켜져 있지 않아요.");

  const sent = await sendPush(sub, { title: "daily-log 알림 테스트", body: "이렇게 매시 정각에 알려드릴게요 📸", url: "/settings", tag: "test" });
  return sent ? ok(undefined) : fail("INTERNAL", "알림을 보내지 못했어요. 알림을 껐다가 다시 켜주세요.");
}
