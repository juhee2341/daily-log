import "server-only";
// web-push 4는 기본 내보내기가 없다 (이름 있는 내보내기만)
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID 환경 변수가 없어요.");
  setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * 구독 하나에 푸시를 보낸다. 브라우저가 구독을 해지했으면(404/410) DB에서도 지운다.
 * @returns 전송 성공 여부
 */
export async function sendPush(subscription: StoredSubscription, payload: PushPayload): Promise<boolean> {
  configure();
  try {
    await sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 30, urgency: "normal" },
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await createAdminClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    } else {
      console.error({ action: "sendPush", status, error });
    }
    return false;
  }
}
