"use client";

import Link from "next/link";
import { useActionState } from "react";
import { redeemTransferCode } from "@/app/actions/transfer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = Awaited<ReturnType<typeof redeemTransferCode>> | null;

/** ID-4: 새 기기에서 코드를 입력해 세션을 옮겨온다. QR로 들어오면 코드가 미리 채워진다(바로 실행하지는 않는다). */
export function TransferRedeemForm({ initialCode }: { initialCode: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => redeemTransferCode(formData), null);
  const failed = state && !state.success ? state : null;
  const codeError = failed?.fieldErrors?.code?.[0];

  if (state?.success) {
    const { moved, skipped } = state.data;
    return (
      <div className="flex flex-col gap-3 rounded-xl border p-5 text-center" role="status">
        <p className="text-lg font-semibold">{moved ? `세션 ${moved}개를 옮겨왔어요` : "옮길 세션이 없었어요"}</p>
        {skipped > 0 && <p className="text-sm text-muted-foreground">{skipped}개 세션은 이 기기에서 이미 참여 중이라 그대로 뒀어요.</p>}
        <Button asChild>
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">옛 기기에서 받은 코드</Label>
        <Input
          id="code"
          name="code"
          defaultValue={initialCode}
          placeholder="ABCD-2345"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={11}
          required
          aria-invalid={!!codeError}
          aria-describedby={codeError ? "code-error" : "code-hint"}
          className="h-12 text-center font-mono text-2xl tracking-widest uppercase"
        />
        {codeError ? (
          <p id="code-error" role="alert" className="text-sm text-destructive">
            {codeError}
          </p>
        ) : (
          <p id="code-hint" className="text-xs text-muted-foreground">
            옛 기기의 설정 → 기기 옮기기에서 만든 8자리 코드예요.
          </p>
        )}
      </div>
      {failed && !codeError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {failed.error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "옮기는 중..." : "이 기기로 옮겨오기"}
      </Button>
    </form>
  );
}
