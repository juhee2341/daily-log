import type { MetadataRoute } from "next";

// N-4: 홈 화면에 추가(PWA). iOS는 홈 화면 앱에서만 웹 푸시를 받을 수 있다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "daily-log",
    short_name: "daily-log",
    description: "설치·가입 없이 링크 하나로, 매시간 함께 찍는 오늘과 어제의 기록",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "white",
    theme_color: "black",
    lang: "ko",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
