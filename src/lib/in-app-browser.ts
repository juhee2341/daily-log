// ID-5: 인앱 브라우저에서는 쿠키가 기본 브라우저와 분리돼 신원이 끊기고 카메라도 불안정하다.

export type InAppBrowser = {
  app: "kakaotalk" | "instagram" | "facebook" | "line" | "naver" | "daum" | "everytime" | "band" | "other";
  os: "android" | "ios" | "other";
};

const APPS: [InAppBrowser["app"], RegExp][] = [
  ["kakaotalk", /KAKAOTALK/i],
  ["instagram", /Instagram/i],
  ["facebook", /FBAN|FBAV|FB_IAB/i],
  ["line", /\bLine\//i],
  ["naver", /NAVER\(inapp/i],
  ["daum", /DaumApps/i],
  ["everytime", /everytimeApp/i],
  ["band", /BAND\//i],
];

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const os: InAppBrowser["os"] = /Android/i.test(userAgent)
    ? "android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "ios"
      : "other";

  for (const [app, pattern] of APPS) {
    if (pattern.test(userAgent)) return { app, os };
  }
  // Android WebView 일반 (`; wv)`)
  if (os === "android" && /; wv\)/.test(userAgent)) return { app: "other", os };
  return null;
}

/** 기본 브라우저로 바로 넘길 수 있는 URL. 자동 전환이 불가능하면 null. */
export function externalOpenUrl(browser: InAppBrowser, url: string): string | null {
  if (browser.app === "kakaotalk") return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (browser.app === "line") {
    const u = new URL(url);
    u.searchParams.set("openExternalBrowser", "1");
    return u.toString();
  }
  if (browser.os === "android") {
    const u = new URL(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
  }
  return null;
}
