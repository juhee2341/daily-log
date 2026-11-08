"use client";

import { useActionState, useState } from "react";
import { leaveSession } from "@/app/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = Awaited<ReturnType<typeof leaveSession>> | null;

/** S-4 / I-7: 방장은 세션 이름을 입력해야 폭파, 멤버는 확인 후 나가기. */
export function LeaveSession({ sessionId, sessionName, isHost }: { sessionId: string; sessionName: string; isHost: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => leaveSession(formData),
    null,
  );
  const failed = state && !state.success ? state : null;
  const nameError = failed?.fieldErrors?.confirmName?.[0];

  if (!open) {
    return (
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {isHost ? "세션 폭파" : "세션 나가기"}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-4" noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      <p className="text-sm">
        {isHost
          ? "방장이 나가면 세션이 폭파돼요. 모든 멤버의 포스트·댓글·영상이 즉시 삭제되고 되돌릴 수 없어요."
          : "나가면 내가 올린 포스트와 댓글이 모두 삭제돼요. 다시 들어오려면 새 초대 링크가 필요해요."}
      </p>
      {isHost && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmName">
            확인을 위해 세션 이름 <strong className="font-semibold">{sessionName}</strong>을(를) 입력해주세요
          </Label>
          <Input
            id="confirmName"
            name="confirmName"
            autoComplete="off"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "confirm-error" : undefined}
            className="h-10"
          />
          {nameError && (
            <p id="confirm-error" role="alert" className="text-sm text-destructive">
              {nameError}
            </p>
          )}
        </div>
      )}
      {failed && !nameError && (
        <p role="alert" className="text-sm text-destructive">
          {failed.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
          취소
        </Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={pending}>
          {pending ? "처리 중..." : isHost ? "폭파하기" : "나가기"}
        </Button>
      </div>
    </form>
  );
}
