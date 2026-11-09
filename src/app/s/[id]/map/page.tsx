import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayMapGrid } from "@/components/map/DayMapGrid";
import { SessionSignalRefresher } from "@/components/session/SessionSignalRefresher";
import { DayTabs } from "@/components/timeline/DayTabs";
import { AuthError, requireMember } from "@/lib/auth";
import { getDayMap } from "@/lib/data/day-map";
import { getSessionOverview } from "@/lib/data/sessions";
import { dayParamSchema } from "@/lib/validators/post.schema";
import { sessionIdSchema } from "@/lib/validators/session.schema";
import { DayMapSkeleton } from "@/components/skeletons/PageSkeletons";

export const metadata: Metadata = { title: "하루 지도" };

export default function MapPage({ params, searchParams }: PageProps<"/s/[id]/map">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <Suspense fallback={<DayMapSkeleton />}>
        <MapContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MapContent({
  params,
  searchParams,
}: {
  params: PageProps<"/s/[id]/map">["params"];
  searchParams: PageProps<"/s/[id]/map">["searchParams"];
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
  const [overview, map] = await Promise.all([getSessionOverview(id, memberId), getDayMap(id, memberId, day)]);
  if (!overview) notFound();
  const posted = map.totals.reduce((a, b) => a + b, 0);

  return (
    <>
      <SessionSignalRefresher sessionId={id} myMemberId={memberId} />
      <nav>
        <Link href={`/s/${id}${day === "yesterday" ? "?day=yesterday" : ""}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {overview.name}
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">하루 지도</h1>
        <p className="text-sm text-muted-foreground">
          {map.rows.length}명 · 기록 {posted}개
        </p>
      </header>
      <DayTabs basePath={`/s/${id}/map`} day={day} logDate={map.logDate} />
      <DayMapGrid sessionId={id} map={map} />
    </>
  );
}
