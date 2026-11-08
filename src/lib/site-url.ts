import "server-only";
import { headers } from "next/headers";

/** 공유 링크의 origin. NEXT_PUBLIC_SITE_URL이 있으면 우선, 없으면 요청 헤더에서 만든다. */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
