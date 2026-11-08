import { isAuthorizedCron } from "@/lib/cron-auth";
import { runDailyMaintenance } from "@/lib/maintenance";

export const maxDuration = 60;

/** 매일 00:05 KST (pg_cron): 보관 기간 정리, 방장 미접속 세션 폭파, 만료 데이터·고아 파일 정리 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "인증되지 않은 요청이에요.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    return Response.json(await runDailyMaintenance());
  } catch (error) {
    console.error({ action: "cron.daily", error });
    return Response.json({ error: "정리 작업 중 오류가 났어요.", code: "INTERNAL" }, { status: 500 });
  }
}
