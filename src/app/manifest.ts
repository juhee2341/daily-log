import type { MetadataRoute } from "next";
import { BRAND_BG } from "@/lib/brand";

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
    background_color: BRAND_BG,
    theme_color: BRAND_BG,
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드가 원·물방울 등으로 잘라 쓰는 용도: 배경을 꽉 채우고 마크는 안전 영역(80%) 안에
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
