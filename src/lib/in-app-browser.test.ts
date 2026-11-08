import { detectInAppBrowser, externalOpenUrl } from "./in-app-browser";

const UA = {
  kakaoAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 KAKAOTALK 10.6.5",
  kakaoIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.5",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  lineAndroid: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 Line/14.6.0",
  androidWebView: "Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Version/4.0 Chrome/124.0 Mobile Safari/537.36",
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
};

describe("detectInAppBrowser", () => {
  it("detects KakaoTalk on Android and iOS", () => {
    expect(detectInAppBrowser(UA.kakaoAndroid)).toEqual({ app: "kakaotalk", os: "android" });
    expect(detectInAppBrowser(UA.kakaoIos)).toEqual({ app: "kakaotalk", os: "ios" });
  });

  it("detects other in-app browsers", () => {
    expect(detectInAppBrowser(UA.instagramIos)).toEqual({ app: "instagram", os: "ios" });
    expect(detectInAppBrowser(UA.lineAndroid)).toEqual({ app: "line", os: "android" });
  });

  it("treats an unknown Android WebView as in-app", () => {
    expect(detectInAppBrowser(UA.androidWebView)).toEqual({ app: "other", os: "android" });
  });

  it("returns null for regular browsers", () => {
    expect(detectInAppBrowser(UA.safari)).toBeNull();
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull();
  });
});

describe("externalOpenUrl", () => {
  const url = "https://daily-log.vercel.app/join/abc?x=1";

  it("uses the KakaoTalk external-open scheme", () => {
    expect(externalOpenUrl({ app: "kakaotalk", os: "ios" }, url)).toBe(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`,
    );
  });

  it("adds LINE's external browser flag", () => {
    expect(externalOpenUrl({ app: "line", os: "android" }, url)).toBe(
      "https://daily-log.vercel.app/join/abc?x=1&openExternalBrowser=1",
    );
  });

  it("uses a Chrome intent for other Android in-app browsers", () => {
    expect(externalOpenUrl({ app: "instagram", os: "android" }, url)).toBe(
      "intent://daily-log.vercel.app/join/abc?x=1#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  it("returns null when iOS apps can't be escaped automatically", () => {
    expect(externalOpenUrl({ app: "instagram", os: "ios" }, url)).toBeNull();
  });
});
