import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { JoinForm } from "@/components/join/JoinForm";
import { PendingWaiter } from "@/components/join/PendingWaiter";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/auth";
import { getJoinState } from "@/lib/data/invites";
import { isWellFormedToken } from "@/lib/invite-token";

export const metadata: Metadata = { title: "초대", robots: { index: false } };

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <JoinContent params={params} />
      </Suspense>
    </main>
  );
}

const DEAD_LINK = {
  invalid: { title: "유효하지 않은 링크예요", body: "링크가 잘못됐거나, 세션이 이미 사라졌어요." },
  revoked: { title: "취소된 링크예요", body: "방장에게 새 링크를 받아주세요." },
  expired: { title: "만료된 링크예요", body: "초대 링크는 24시간 동안만 쓸 수 있어요. 방장에게 새 링크를 받아주세요." },
  used: { title: "이미 사용된 링크예요", body: "초대 링크는 한 번만 쓸 수 있어요. 방장에게 새 링크를 받아주세요." },
} as const;

async function JoinContent({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  const { token } = await params;
  const userId = await getCurrentUserId();
  const state = isWellFormedToken(token) ? await getJoinState(token, userId) : ({ kind: "invalid" } as const);

  if (state.kind === "member") redirect(`/s/${state.sessionId}`);

  if (state.kind === "open") {
    return (
      <>
        <header className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">초대받은 세션</p>
          <h1 className="text-2xl font-bold">{state.sessionName}</h1>
        </header>
        <JoinForm token={token} />
      </>
    );
  }

  if (state.kind === "pending") {
    return (
      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-bold">{state.sessionName}</h1>
        <p className="text-sm">
          <strong>{state.nickname}</strong>(으)로 참여를 요청했어요.
        </p>
        <PendingWaiter memberId={state.memberId} />
        <p className="text-xs text-muted-foreground">이 화면을 닫아도 괜찮아요. 승인되면 홈에서 세션이 열려요.</p>
      </section>
    );
  }

  const message =
    state.kind === "rejected"
      ? { title: "참여가 거절됐어요", body: `${state.sessionName} 방장이 요청을 거절했어요.` }
      : DEAD_LINK[state.kind];

  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-xl font-bold">{message.title}</h1>
      <p className="text-sm text-muted-foreground">{message.body}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">홈으로</Link>
      </Button>
    </section>
  );
}
