"use server";

import { refresh } from "next/cache";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireHost } from "@/lib/auth";
import { signalSession } from "@/lib/realtime";
import { getLogDate } from "@/lib/slot";
import { createAdminClient } from "@/lib/supabase/admin";
import { setMissionSchema } from "@/lib/validators/mission.schema";

/** S-7: 방장이 오늘의 미션을 정하거나 고친다. 비우면 지운다. */
export async function setMission(formData: FormData): Promise<ActionResult> {
  const parsed = setMissionSchema.safeParse({ sessionId: formData.get("sessionId"), body: formData.get("body") ?? "" });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);
  const { sessionId, body } = parsed.data;

  try {
    await requireHost(sessionId);
  } catch (error) {
    return authFailure(error);
  }

  const admin = createAdminClient();
  const logDate = getLogDate(new Date());
  const { error } = body
    ? await admin
        .from("missions")
        .upsert({ session_id: sessionId, log_date: logDate, body, updated_at: new Date().toISOString() })
    : await admin.from("missions").delete().eq("session_id", sessionId).eq("log_date", logDate);
  if (error) {
    console.error({ action: "setMission", sessionId, error });
    return fail("INTERNAL", "미션을 저장하지 못했어요.");
  }

  await signalSession(sessionId, { type: "mission.updated" });
  refresh();
  return ok(undefined);
}
