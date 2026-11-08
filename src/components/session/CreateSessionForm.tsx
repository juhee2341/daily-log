"use client";

import { useActionState } from "react";
import { createSession } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = Awaited<ReturnType<typeof createSession>> | null;

export function CreateSessionForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => createSession(formData),
    null,
  );
  const failed = state && !state.success ? state : null;
  const nameError = failed?.fieldErrors?.name?.[0];
  const nicknameError = failed?.fieldErrors?.nickname?.[0];
  const formError = failed && !failed.fieldErrors ? failed.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">세션 이름</Label>
        <Input
          id="name"
          name="name"
          placeholder="예: 제주도 2박 3일"
          maxLength={30}
          autoComplete="off"
          required
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "name-error" : undefined}
          className="h-11"
        />
        {nameError && (
          <p id="name-error" role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">내 닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          placeholder="이 세션에서 쓸 이름"
          maxLength={12}
          autoComplete="nickname"
          required
          aria-invalid={!!nicknameError}
          aria-describedby={nicknameError ? "nickname-error" : "nickname-hint"}
          className="h-11"
        />
        {nicknameError ? (
          <p id="nickname-error" role="alert" className="text-sm text-destructive">
            {nicknameError}
          </p>
        ) : (
          <p id="nickname-hint" className="text-xs text-muted-foreground">
            12자 이하 · 세션마다 다르게 정할 수 있어요
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "만드는 중..." : "세션 만들기"}
      </Button>
    </form>
  );
}
