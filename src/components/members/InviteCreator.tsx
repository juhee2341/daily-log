"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InviteKind } from "@/types/database";

type State = Awaited<ReturnType<typeof createInvite>> | null;

const KINDS: { value: InviteKind; label: string; hint: string }[] = [
  { value: "single", label: "개인 링크", hint: "1명 · 한 번만" },
  { value: "group", label: "그룹 링크", hint: "여러 명 · 24시간" },
];

export function InviteCreator({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => createInvite(formData),
    null,
  );
  const [copied, setCopied] = useState(false);
  const [kind, setKind] = useState<InviteKind>("single");
  const failed = state && !state.success ? state : null;
  const memoError = failed?.fieldErrors?.memo?.[0];
  const created = state?.success ? state.data : null;

  async function share(url: string, linkKind: InviteKind) {
    const text =
      linkKind === "group"
        ? `[daily-log] '${sessionName}'에 함께해요. 24시간 동안 여럿이 쓸 수 있는 링크예요.`
        : `[daily-log] '${sessionName}'에 초대할게요. 24시간 안에, 한 번만 쓸 수 있는 링크예요.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: sessionName, text, url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우 — 복사로 대체하지 않는다
        return;
      }
    }
    await copy(url);
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="sessionId" value={sessionId} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">링크 종류</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  kind === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="memo">메모 (나만 보여요)</Label>
            <Input
              id="memo"
              name="memo"
              placeholder={kind === "group" ? "예: 동기 단톡방" : "예: 민지한테"}
              autoComplete="off"
              aria-invalid={!!memoError}
              aria-describedby={memoError ? "memo-error" : undefined}
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10" disabled={pending}>
            {pending ? "만드는 중..." : "링크 만들기"}
          </Button>
        </div>
      </form>
      {memoError && (
        <p id="memo-error" role="alert" className="text-sm text-destructive">
          {memoError}
        </p>
      )}
      {failed && !memoError && (
        <p role="alert" className="text-sm text-destructive">
          {failed.error}
        </p>
      )}

      {created && (
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3" role="status">
          <p className="text-xs text-muted-foreground">
            새 {created.kind === "group" ? "그룹 링크" : "개인 링크"}가 만들어졌어요. 이 링크는 <strong>지금만</strong> 볼 수
            있어요.
            {created.kind === "group" && " 단톡방에 올리면 여러 명이 요청할 수 있고, 한 명씩 승인하면 돼요."}
          </p>
          <p className="break-all font-mono text-xs">{created.url}</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => share(created.url, created.kind)}>
              공유하기
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => copy(created.url)}>
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
