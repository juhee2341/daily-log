import Link from "next/link";
import { Suspense } from "react";
import { HomeNotice } from "@/components/home/HomeNotice";
import { MySessionList, MySessionListSkeleton } from "@/components/home/MySessionList";
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
        <Suspense fallback={<MySessionListSkeleton />}>
          <MySessionList />
        </Suspense>
      </section>
    </main>
  );
}
