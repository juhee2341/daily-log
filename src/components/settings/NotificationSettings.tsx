"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush, updateQuietHours } from "@/app/actions/push";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/public-env";
import { detectPushSupport, registerServiceWorker, urlBase64ToUint8Array, type PushSupport } from "@/lib/pwa";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const subscribe = () => () => {};
let cachedSupport: PushSupport | null = null;
const readSupport = () => (cachedSupport ??= detectPushSupport());

type Props = { initialQuiet: { start: number; end: number } };

/** N-1~N-4: 이 기기의 슬롯 알림 켜기/끄기, 방해금지 시간, 테스트 알림. */
export function NotificationSettings({ initialQuiet }: Props) {
  const support = useSyncExternalStore(subscribe, readSupport, () => null);
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined); // undefined = 확인 중
  const [quiet, setQuiet] = useState(initialQuiet);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // 이 브라우저에 이미 구독이 있는지 (외부 시스템 조회)
  useEffect(() => {
    if (support !== "supported") return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => !cancelled && setEndpoint(sub?.endpoint ?? null))
      .catch(() => !cancelled && setEndpoint(null));
    return () => {
      cancelled = true;
    };
  }, [support]);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage({ tone: "error", text: "알림 권한이 거부됐어요. 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용해주세요." });
        return;
      }
      try {
        const reg = await registerServiceWorker();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey) }));
        const result = await savePushSubscription({ ...sub.toJSON(), quietStart: quiet.start, quietEnd: quiet.end });
        if (!result.success) {
          await sub.unsubscribe();
          setMessage({ tone: "error", text: result.error });
          return;
        }
        setEndpoint(sub.endpoint);
        setMessage({ tone: "info", text: "알림을 켰어요. 매시 정각에 알려드릴게요." });
      } catch {
        setMessage({ tone: "error", text: "알림을 켜지 못했어요. 잠시 후 다시 시도해주세요." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setMessage({ tone: "info", text: "알림을 껐어요." });
    });

  const changeQuiet = (next: { start: number; end: number }) => {
    setQuiet(next);
    if (!endpoint) return;
    startTransition(async () => {
      const result = await updateQuietHours(endpoint, next.start, next.end);
      setMessage(result.success ? { tone: "info", text: "방해금지 시간을 저장했어요." } : { tone: "error", text: result.error });
    });
  };

  const test = () =>
    endpoint &&
    startTransition(async () => {
      const result = await sendTestPush(endpoint);
      setMessage(result.success ? { tone: "info", text: "테스트 알림을 보냈어요. 잠시 후 도착해요." } : { tone: "error", text: result.error });
    });

  if (support === null || (support === "supported" && endpoint === undefined)) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />;
  }
  if (support === "ios-needs-install") {
    return <p className="rounded-xl bg-muted p-4 text-sm leading-relaxed">iPhone에서는 <strong>홈 화면에 추가</strong>한 daily-log 앱에서만 알림을 받을 수 있어요. 아래 안내대로 추가한 뒤, 홈 화면 아이콘으로 열어서 알림을 켜주세요.</p>;
  }
  if (support === "unsupported") {
    return <p className="rounded-xl bg-muted p-4 text-sm">이 브라우저는 웹 알림을 지원하지 않아요.</p>;
  }

  const on = !!endpoint;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="font-medium">매시 정각 촬영 알림</p>
          <p className="text-xs text-muted-foreground">참여 중인 세션에서 아직 안 찍은 시간대만 알려요</p>
        </div>
        <Button variant={on ? "outline" : "default"} onClick={on ? disable : enable} disabled={pending} aria-pressed={on}>
          {pending ? "..." : on ? "끄기" : "켜기"}
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-xl border p-4" disabled={pending}>
        <legend className="px-1 text-sm font-medium">방해금지 시간</legend>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="quiet-start" className="sr-only">
            시작
          </label>
          <select
            id="quiet-start"
            value={quiet.start}
            onChange={(e) => changeQuiet({ ...quiet, start: Number(e.target.value) })}
            className="h-9 rounded-lg border bg-background px-2"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span aria-hidden>~</span>
          <label htmlFor="quiet-end" className="sr-only">
            끝
          </label>
          <select
            id="quiet-end"
            value={quiet.end}
            onChange={(e) => changeQuiet({ ...quiet, end: Number(e.target.value) })}
            className="h-9 rounded-lg border bg-background px-2"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">{quiet.start === quiet.end ? "(방해금지 없음)" : "에는 알리지 않아요"}</span>
        </div>
      </fieldset>

      {on && (
        <Button variant="ghost" onClick={test} disabled={pending}>
          테스트 알림 보내기
        </Button>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
