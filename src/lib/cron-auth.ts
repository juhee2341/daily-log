import "server-only";
import { timingSafeEqual } from "node:crypto";

/** /api/cron/* 요청이 pg_cron(Authorization: Bearer CRON_SECRET)에서 왔는지 확인한다. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
