"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelPost } from "@/app/actions/post";
import { Countdown } from "@/components/timeline/Countdown";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";

/** P-5: 올린 뒤 3분 동안만 보이는 올리기 취소 버튼. */
export function CancelPostButton({ sessionId, postId, until }: { sessionId: string; postId: string; until: string }) {
  const router = useRouter();
  const now = useNow();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (now !== null && now >= new Date(until).getTime()) return null;

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelPost(sessionId, postId);
            if (!result.success) return setError(result.error);
            router.replace(`/s/${sessionId}`);
          })
        }
      >
        {pending ? "취소하는 중..." : (
          <>
            올리기 취소 · <Countdown target={until} />
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
