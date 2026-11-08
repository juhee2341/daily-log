"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const subscribe = () => () => {};
let cachedEnv: { standalone: boolean; ios: boolean } | null = null;
const readEnv = () => (cachedEnv ??= { standalone: isStandalone(), ios: isIos(navigator.userAgent) });

/** N-4: 홈 화면에 추가 안내. Android/데스크톱 Chrome은 설치 버튼, iOS는 단계 안내. */
export function InstallGuide() {
  const env = useSyncExternalStore(subscribe, readEnv, () => null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!env) return null;
  if (env.standalone || installed) return <p className="text-sm text-muted-foreground">홈 화면 앱으로 실행 중이에요 ✓</p>;

  if (prompt) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          await prompt.prompt();
          if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
      >
        홈 화면에 추가
      </Button>
    );
  }

  return env.ios ? (
    <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
      <li>
        <strong>Safari</strong>로 이 페이지를 열어요
      </li>
      <li>
        아래쪽 <strong>공유 버튼(⬆︎)</strong>을 눌러요
      </li>
      <li>
        <strong>홈 화면에 추가</strong>를 골라요
      </li>
      <li>홈 화면의 daily-log 아이콘으로 열면 알림을 켤 수 있어요</li>
    </ol>
  ) : (
    <p className="text-sm text-muted-foreground">브라우저 메뉴(⋮)에서 <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong>를 눌러주세요.</p>
  );
}
