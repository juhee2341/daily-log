"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { detectInAppBrowser, externalOpenUrl, type InAppBrowser } from "@/lib/in-app-browser";

const DISMISS_KEY = "daily-log:in-app-dismissed";
const subscribe = () => () => {};

// useSyncExternalStore의 스냅샷은 호출마다 같은 값을 돌려줘야 한다.
// 매번 새 객체를 만들면 React가 "값이 계속 바뀐다"고 보고 무한 렌더링에 빠진다 (인앱 브라우저에서만 발생했던 버그).
let cached: { userAgent: string; browser: InAppBrowser | null } | null = null;

function readBrowser(): InAppBrowser | null {
  try {
    if (sessionStorage.getItem(DISMISS_KEY)) return null;
  } catch {
    // 저장소 접근이 막힌 환경 — 무시
  }
  const userAgent = navigator.userAgent;
  if (cached?.userAgent !== userAgent) cached = { userAgent, browser: detectInAppBrowser(userAgent) };
  return cached.browser;
}

/** ID-5: 인앱 브라우저면 기본 브라우저로 열도록 안내한다. 서버 렌더에서는 아무것도 그리지 않는다. */
export function InAppBrowserGate() {
  const browser = useSyncExternalStore(subscribe, readBrowser, () => null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!browser || dismissed) return null;

  const target = externalOpenUrl(browser, window.location.href);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 무시
    }
    setDismissed(true);
  }

  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inapp-title" className="fixed inset-0 z-50 flex items-end bg-background/95 p-4 sm:items-center sm:justify-center">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-background p-5 shadow-lg">
        <h2 id="inapp-title" className="text-lg font-bold">
          기본 브라우저로 열어주세요
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          앱 안의 브라우저에서는 참여 정보가 저장되지 않아, 나중에 다른 사람으로 인식될 수 있어요. 카메라도 잘 안 될 수 있어요.
        </p>
        {target ? (
          <Button size="lg" className="h-11" onClick={() => window.location.assign(target)}>
            기본 브라우저로 열기
          </Button>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>화면 오른쪽 아래(또는 위)의 <strong>⋯ / 공유</strong> 버튼을 눌러요</li>
            <li>
              <strong>Safari로 열기</strong> 또는 <strong>다른 브라우저로 열기</strong>를 골라요
            </li>
          </ol>
        )}
        <Button variant="outline" onClick={copy}>
          {copied ? "링크 복사됨 — 브라우저에 붙여넣어 주세요" : "링크 복사"}
        </Button>
        <button type="button" onClick={dismiss} className="text-xs text-muted-foreground underline underline-offset-4">
          그냥 여기서 계속하기
        </button>
      </div>
    </div>
  );
}
