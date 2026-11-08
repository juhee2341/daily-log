"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authFailure, fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTransferCode, hashTransferCode } from "@/lib/transfer-code";
import { TRANSFER_TTL_MS, formatTransferCode, normalizeTransferCode } from "@/lib/transfer-format";

/** ID-4: 옛 기기에서 10분짜리 1회용 코드를 만든다. 이전 코드는 무효화한다. */
export async function createTransferCode(): Promise<ActionResult<{ code: string; url: string; expiresAt: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return fail("NOT_FOUND", "이 기기에는 옮길 세션이 없어요.");

  const admin = createAdminClient();
  const { count } = await admin.from("members").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) return fail("NOT_FOUND", "이 기기에는 옮길 세션이 없어요.");

  await admin.from("transfer_codes").update({ used_at: new Date().toISOString() }).eq("from_user_id", userId).is("used_at", null);

  const code = generateTransferCode();
  const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS).toISOString();
  const { error } = await admin.from("transfer_codes").insert({ code_hash: hashTransferCode(code), from_user_id: userId, expires_at: expiresAt });
  if (error) {
    console.error({ userId, action: "createTransferCode", error });
    return fail("INTERNAL", "코드를 만들지 못했어요. 다시 시도해주세요.");
  }

  return ok({ code: formatTransferCode(code), url: `${await getSiteUrl()}/transfer?code=${code}`, expiresAt });
}

const redeemSchema = z.object({
  code: z.string().transform((v, ctx) => {
    const code = normalizeTransferCode(v);
    if (!code) ctx.addIssue({ code: "custom", message: "코드 8자리를 확인해주세요." });
    return code ?? "";
  }),
});

/** ID-4: 새 기기에서 코드를 입력하면 옛 기기의 세션 멤버십(방장 권한 포함)을 이 기기로 옮긴다. */
export async function redeemTransferCode(formData: FormData): Promise<ActionResult<{ moved: number; skipped: number }>> {
  const parsed = redeemSchema.safeParse({ code: formData.get("code") ?? "" });
  if (!parsed.success) return fail("VALIDATION_ERROR", "입력값을 확인해주세요.", parsed.error.flatten().fieldErrors);

  let userId: string;
  try {
    userId = await requireUser();
  } catch (error) {
    return authFailure(error);
  }

  const { data, error } = await createAdminClient().rpc("transfer_identity", {
    p_code_hash: hashTransferCode(parsed.data.code),
    p_to: userId,
  });
  if (error) {
    console.error({ userId, action: "redeemTransferCode", error });
    return fail("INTERNAL", "옮기지 못했어요. 다시 시도해주세요.");
  }

  const result = data as { moved?: number; skipped?: number; error?: "invalid" | "same_device" };
  if (result.error === "same_device") return fail("VALIDATION_ERROR", "코드를 만든 기기에서는 입력할 수 없어요. 새 기기에서 입력해주세요.");
  if (result.error) return fail("NOT_FOUND", "코드가 틀렸거나, 이미 썼거나, 10분이 지났어요. 옛 기기에서 새 코드를 만들어주세요.");

  refresh();
  return ok({ moved: result.moved ?? 0, skipped: result.skipped ?? 0 });
}
