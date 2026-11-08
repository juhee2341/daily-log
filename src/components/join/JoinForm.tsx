"use client";

import { useActionState } from "react";
import { requestJoin } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = Awaited<ReturnType<typeof requestJoin>> | null;

export function JoinForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => requestJoin(formData),
    null,
  );
  const failed = state && !state.success ? state : null;
  const nicknameError = failed?.fieldErrors?.nickname?.[0];
  const formError = failed && !nicknameError ? failed.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          placeholder="이 세션에서 쓸 이름"
          maxLength={12}
          autoComplete="nickname"
          required
          aria-invalid={!!nicknameError}
          aria-describedby={nicknameError ? "nickname-error" : "join-notice"}
          className="h-11"
        />
        {nicknameError && (
          <p id="nickname-error" role="alert" className="text-sm text-destructive">
            {nicknameError}
          </p>
        )}
      </div>

      <p id="join-notice" className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
        방장이 승인하면 들어갈 수 있어요. 참여하면 내 포스트가 세션 브이로그에 포함되어 다른 멤버가 영상으로 저장할 수 있어요.
        이 링크는 한 번만 쓸 수 있어요.
      </p>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "요청 중..." : "참여 요청"}
      </Button>
    </form>
  );
}
