import Link from "next/link";
import { Suspense } from "react";
import { HomeNotice } from "@/components/home/HomeNotice";
import { MySessionList } from "@/components/home/MySessionList";
import { SessionListSkeleton } from "@/components/skeletons/PageSkeletons";
import { Button } from "@/components/ui/button";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">daily-log</h1>
          <p className="text-sm text-muted-foreground">매시간 함께 찍는 오늘과 어제의 기록</p>
        </div>
        <Link href="/settings" className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          알림·설정
        </Link>
      </header>

      <Suspense>
        <HomeNotice searchParams={searchParams} />
      </Suspense>

      <Button asChild size="lg" className="h-11">
        <Link href="/new">새 세션 만들기</Link>
      </Button>

      <section className="flex flex-col gap-3" aria-labelledby="my-sessions-heading">
        <h2 id="my-sessions-heading" className="text-sm font-semibold text-muted-foreground">
          내 세션
        </h2>
        <Suspense fallback={<SessionListSkeleton />}>
          <MySessionList />
        </Suspense>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        휴대폰을 바꿨나요?{" "}
        <Link href="/transfer" className="font-medium text-foreground underline underline-offset-4">
          기기 옮기기
        </Link>
      </p>
    </main>
  );
}
