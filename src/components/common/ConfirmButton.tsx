"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  confirmLabel: string;
  question: string;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
  variant?: ComponentProps<typeof Button>["variant"];
};

/** 브라우저 confirm() 대신 쓰는 2단계 버튼. */
export function ConfirmButton({ label, confirmLabel, question, onConfirm, variant = "outline" }: Props) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <Button size="sm" variant={variant} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" role="group" aria-label={question}>
      <span className="text-xs text-muted-foreground">{question}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
          취소
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onConfirm();
              if (!result.success) setError(result.error ?? "처리하지 못했어요.");
              else setAsking(false);
            })
          }
        >
          {pending ? "처리 중..." : confirmLabel}
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
