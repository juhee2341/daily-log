import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionSignalRefresher } from "@/components/session/SessionSignalRefresher";
import { Countdown } from "@/components/timeline/Countdown";
import { Button } from "@/components/ui/button";
import { AuthError, requireMember } from "@/lib/auth";
import { getSessionOverview } from "@/lib/data/sessions";
import { getTimeline, type Timeline, type TimelinePost } from "@/lib/data/timeline";
import { formatKst } from "@/lib/slot";
import { cn } from "@/lib/utils";
import { dayParamSchema } from "@/lib/validators/post.schema";
import { sessionIdSchema } from "@/lib/validators/session.schema";

export default function SessionPage({ params, searchParams }: PageProps<"/s/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <nav>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
      </nav>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <SessionContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SessionContent({
  params,
  searchParams,
}: {
  params: PageProps<"/s/[id]">["params"];
  searchParams: PageProps<"/s/[id]">["searchParams"];
}) {
  const { id } = await params;
  if (!sessionIdSchema.safeParse(id).success) notFound();
  const day = dayParamSchema.parse((await searchParams).day);

  let memberId: string;
  try {
    memberId = (await requireMember(id)).member.id;
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }

  const [overview, timeline] = await Promise.all([getSessionOverview(id, memberId), getTimeline(id, memberId, day)]);
  if (!overview) notFound();

  return (
    <>
      <SessionSignalRefresher sessionId={id} myMemberId={memberId} />
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-bold">{overview.name}</h1>
          <p className="text-sm text-muted-foreground">
            {overview.me.nickname}
            {overview.me.role === "host" ? " · 방장" : ""} · 멤버 {overview.members.length}명
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/s/${id}/members`}>{overview.me.role === "host" ? "멤버·초대" : "멤버"}</Link>
        </Button>
      </header>

      <DayTabs sessionId={id} day={day} logDate={timeline.logDate} />
      <TimelineView sessionId={id} timeline={timeline} />
    </>
  );
}

function DayTabs({ sessionId, day, logDate }: { sessionId: string; day: Timeline["day"]; logDate: string }) {
  const tabs = [
    { key: "today", label: "오늘", href: `/s/${sessionId}` },
    { key: "yesterday", label: "어제", href: `/s/${sessionId}?day=yesterday` },
  ] as const;
  return (
    <nav aria-label="날짜" className="flex items-center gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={day === tab.key ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            day === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
      <span className="ml-auto text-xs text-muted-foreground">{formatKst(`${logDate}T12:00:00+09:00`, "M월 d일")}</span>
    </nav>
  );
}

function TimelineView({ sessionId, timeline }: { sessionId: string; timeline: Timeline }) {
  const nextSlot = timeline.current
    ? new Date(new Date(timeline.current.slotStart).getTime() + 60 * 60 * 1000).toISOString()
    : null;

  if (!timeline.slots.length) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">이 날은 올라온 기록이 없어요.</p>;
  }

  return (
    <ol className="flex flex-col gap-5">
      {timeline.slots.map((slot) => {
        const isCurrent = timeline.current?.slotStart === slot.slotStart;
        return (
          <li key={slot.slotStart} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <time dateTime={slot.slotStart}>{formatKst(slot.slotStart, "HH:00")}</time>
              {isCurrent && nextSlot && (
                <span className="text-xs font-normal text-muted-foreground">
                  ● 지금 · <Countdown target={nextSlot} suffix=" 남음" />
                </span>
              )}
            </h2>
            <ul className="grid grid-cols-3 gap-2">
              {slot.posts.map((post) => (
                <PostThumb key={post.id} sessionId={sessionId} post={post} />
              ))}
              {isCurrent && !timeline.current?.posted && (
                <li>
                  <Link
                    href={`/s/${sessionId}/capture`}
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    <span aria-hidden className="text-2xl leading-none">
                      +
                    </span>
                    촬영
                  </Link>
                </li>
              )}
            </ul>
            {isCurrent && timeline.current?.posted && nextSlot && (
              <p className="text-xs text-muted-foreground">
                이번 시간대는 올렸어요 · 다음 촬영까지 <Countdown target={nextSlot} />
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PostThumb({ sessionId, post }: { sessionId: string; post: TimelinePost }) {
  return (
    <li>
      <Link
        href={`/s/${sessionId}/p/${post.id}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {post.thumbUrl && (
          // 서명 URL(1시간)이라 next/image 최적화 대상이 아니다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbUrl} alt={`${post.nickname}의 ${post.mediaType === "video" ? "영상" : "사진"}`} className="size-full object-cover" loading="lazy" />
        )}
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-xs font-medium text-white">
          {post.nickname}
        </span>
        {post.mediaType === "video" && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white" aria-hidden>
            ▶
          </span>
        )}
      </Link>
    </li>
  );
}
