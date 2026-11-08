import { isAuthorizedCron } from "@/lib/cron-auth";
import { dispatchSlotReminders } from "@/lib/push-reminders";

/** 매시 정각 (pg_cron): N-2 슬롯 알림 발송 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "인증되지 않은 요청이에요.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    return Response.json(await dispatchSlotReminders());
  } catch (error) {
    console.error({ action: "cron.hourly", error });
    return Response.json({ error: "알림 발송 중 오류가 났어요.", code: "INTERNAL" }, { status: 500 });
  }
}
