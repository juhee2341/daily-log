import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionSignalRefresher } from "@/components/session/SessionSignalRefresher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthError, requireMember } from "@/lib/auth";
import { getSessionOverview } from "@/lib/data/sessions";
import { sessionIdSchema } from "@/lib/validators/session.schema";

export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <nav>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
      </nav>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <SessionContent params={params} />
      </Suspense>
    </main>
  );
}

async function SessionContent({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  if (!sessionIdSchema.safeParse(id).success) notFound();

  let memberId: string;
  try {
    memberId = (await requireMember(id)).member.id;
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }

  const overview = await getSessionOverview(id, memberId);
  if (!overview) notFound();

  return (
    <>
      <SessionSignalRefresher sessionId={id} myMemberId={memberId} />
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-bold">{overview.name}</h1>
          <p className="text-sm text-muted-foreground">
            {overview.me.nickname}
            {overview.me.role === "host" ? " · 방장" : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/s/${id}/members`}>{overview.me.role === "host" ? "멤버·초대" : "멤버"}</Link>
        </Button>
      </header>

      <section aria-labelledby="members-heading" className="flex flex-col gap-2">
        <h2 id="members-heading" className="text-sm font-semibold text-muted-foreground">
          멤버 {overview.members.length}명
        </h2>
        <ul className="flex flex-wrap gap-2">
          {overview.members.map((m) => (
            <li key={m.id}>
              <Badge variant={m.role === "host" ? "default" : "secondary"}>{m.nickname}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        타임라인·촬영은 다음 단계에서 붙어요.
      </p>
    </>
  );
}
