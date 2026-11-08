"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">문제가 생겼어요</h1>
      <p className="text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
