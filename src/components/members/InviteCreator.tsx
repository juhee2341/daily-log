"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = Awaited<ReturnType<typeof createInvite>> | null;

export function InviteCreator({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => createInvite(formData),
    null,
  );
  const [copied, setCopied] = useState(false);
  const failed = state && !state.success ? state : null;
  const memoError = failed?.fieldErrors?.memo?.[0];
  const link = state?.success ? state.data.url : null;

  async function share(url: string) {
    const text = `[daily-log] '${sessionName}'에 초대할게요. 24시간 안에, 한 번만 쓸 수 있는 링크예요.`;
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
      <form action={formAction} className="flex items-end gap-2" noValidate>
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="memo">메모 (나만 보여요)</Label>
          <Input
            id="memo"
            name="memo"
            placeholder="예: 민지한테"
            maxLength={20}
            autoComplete="off"
            aria-invalid={!!memoError}
            aria-describedby={memoError ? "memo-error" : undefined}
            className="h-10"
          />
        </div>
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "만드는 중..." : "링크 만들기"}
        </Button>
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

      {link && (
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3" role="status">
          <p className="text-xs text-muted-foreground">
            새 링크가 만들어졌어요. 이 링크는 <strong>지금만</strong> 볼 수 있어요.
          </p>
          <p className="break-all font-mono text-xs">{link}</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => share(link)}>
              공유하기
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => copy(link)}>
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
