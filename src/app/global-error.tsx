"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">문제가 생겼어요</h1>
        <p className="text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <button type="button" onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          다시 시도
        </button>
      </body>
    </html>
  );
}
