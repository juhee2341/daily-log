import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
// 본문·UI 글꼴 Pretendard (OFL). 다이내믹 서브셋: 화면에 쓰인 글자가 든 조각만 내려받는다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import { InAppBrowserGate } from "@/components/browser/InAppBrowserGate";
import { BRAND_BG } from "@/lib/brand";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "daily-log", template: "%s · daily-log" },
  description: "설치·가입 없이 링크 하나로, 매시간 함께 찍는 오늘과 어제의 기록",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BRAND_BG,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <InAppBrowserGate />
      </body>
    </html>
  );
}
