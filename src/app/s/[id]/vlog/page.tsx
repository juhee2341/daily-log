import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayTabs } from "@/components/timeline/DayTabs";
import { VlogExporter } from "@/components/vlog/VlogExporter";
import { VlogPlayer } from "@/components/vlog/VlogPlayer";
import { AuthError, requireMember } from "@/lib/auth";
import { getSessionOverview } from "@/lib/data/sessions";
import { getVlog } from "@/lib/data/vlog";
import { formatKst } from "@/lib/slot";
import { cn } from "@/lib/utils";
import { dayParamSchema } from "@/lib/validators/post.schema";
import { sessionIdSchema } from "@/lib/validators/session.schema";
import { z } from "zod";

export const metadata: Metadata = { title: "브이로그" };

export default function VlogPage({ params, searchParams }: PageProps<"/s/[id]/vlog">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<div className="aspect-[9/16] max-h-[72dvh] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <VlogContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function VlogContent({
  params,
  searchParams,
}: {
  params: PageProps<"/s/[id]/vlog">["params"];
  searchParams: PageProps<"/s/[id]/vlog">["searchParams"];
}) {
  const { id } = await params;
  if (!sessionIdSchema.safeParse(id).success) notFound();
  const query = await searchParams;
  const day = dayParamSchema.parse(query.day);
  const memberParam = z.uuid().safeParse(query.member);
  const memberFilter = memberParam.success ? memberParam.data : null;

  let memberId: string;
  try {
    memberId = (await requireMember(id)).member.id;
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  const [overview, vlog] = await Promise.all([getSessionOverview(id, memberId), getVlog(id, day, memberFilter)]);
  if (!overview) notFound();

  const selected = vlog.members.find((m) => m.id === memberFilter);
  const dayQuery = day === "yesterday" ? "day=yesterday" : "";
  const href = (member?: string) => {
    const q = [dayQuery, member && `member=${member}`].filter(Boolean).join("&");
    return `/s/${id}/vlog${q ? `?${q}` : ""}`;
  };
  const dateLabel = formatKst(`${vlog.logDate}T12:00:00+09:00`, "yyyy년 M월 d일");

  return (
    <>
      <nav>
        <Link href={`/s/${id}${dayQuery ? `?${dayQuery}` : ""}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {overview.name}
        </Link>
      </nav>
      <h1 className="text-xl font-bold">브이로그</h1>
      <DayTabs basePath={`/s/${id}/vlog`} day={day} logDate={vlog.logDate} />

      <nav aria-label="보기 방식" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ id: undefined, label: "전체", count: vlog.members.reduce((n, m) => n + m.count, 0) }, ...vlog.members.map((m) => ({ id: m.id, label: m.nickname, count: m.count }))].map(
          (chip) => {
            const active = (chip.id ?? null) === (selected?.id ?? null);
            return (
              <Link
                key={chip.id ?? "all"}
                href={href(chip.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {chip.label} <span className="text-xs opacity-70">{chip.count}</span>
              </Link>
            );
          },
        )}
      </nav>

      {vlog.items.length ? (
        <>
          {/* 모드가 바뀌면 처음부터 다시 재생 */}
          <VlogPlayer key={`${day}:${selected?.id ?? "all"}`} items={vlog.items} />
          <VlogExporter
            key={`export:${day}:${selected?.id ?? "all"}`}
            items={vlog.items}
            title={selected ? `${overview.name} · ${selected.nickname}` : overview.name}
            subtitle={dateLabel}
            logDate={vlog.logDate}
            label={selected?.nickname ?? "전체"}
          />
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">이 날은 아직 기록이 없어요.</p>
      )}
    </>
  );
}
