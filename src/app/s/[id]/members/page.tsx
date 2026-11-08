import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HostOnlyHint } from "@/components/members/HostOnlyHint";
import { KickButton, PendingItem, RevokeButton } from "@/components/members/HostLists";
import { InviteCreator } from "@/components/members/InviteCreator";
import { LeaveSession } from "@/components/members/LeaveSession";
import { SessionSignalRefresher } from "@/components/session/SessionSignalRefresher";
import { Badge } from "@/components/ui/badge";
import { AuthError, requireMember } from "@/lib/auth";
import { getMembersPageData } from "@/lib/data/members";
import { formatKst } from "@/lib/slot";
import { sessionIdSchema } from "@/lib/validators/session.schema";

export const metadata: Metadata = { title: "멤버" };

export default function MembersPage({ params }: PageProps<"/s/[id]/members">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <MembersContent params={params} />
      </Suspense>
    </main>
  );
}

async function MembersContent({ params }: { params: PageProps<"/s/[id]/members">["params"] }) {
  const { id } = await params;
  if (!sessionIdSchema.safeParse(id).success) notFound();

  let me;
  try {
    ({ member: me } = await requireMember(id));
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  const isHost = me.role === "host";
  const data = await getMembersPageData(id, isHost);
  if (!data) notFound();

  return (
    <>
      <SessionSignalRefresher sessionId={id} myMemberId={me.id} />
      <nav>
        <Link href={`/s/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {data.sessionName}
        </Link>
      </nav>
      <h1 className="text-xl font-bold">멤버</h1>

      {isHost && (
        <section aria-labelledby="invite-heading" className="flex flex-col gap-3">
          <h2 id="invite-heading" className="text-sm font-semibold text-muted-foreground">
            초대하기
          </h2>
          <InviteCreator sessionId={id} sessionName={data.sessionName} />
          {data.invites.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="아직 안 쓴 링크">
              {data.invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {invite.memo ?? "메모 없음"}
                    <span className="text-xs text-muted-foreground">
                      {" "}· {formatKst(invite.createdAt, "HH:mm")} 생성 · {formatKst(invite.expiresAt, "M/d HH:mm")}까지
                    </span>
                  </span>
                  <RevokeButton sessionId={id} inviteId={invite.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isHost && (
        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <h2 id="pending-heading" className="text-sm font-semibold text-muted-foreground">
            승인 대기 {data.pending.length}명
          </h2>
          {data.pending.length ? (
            <ul className="flex flex-col gap-2">
              {data.pending.map((member) => (
                <PendingItem
                  key={member.id}
                  sessionId={id}
                  member={member}
                  createdLabel={member.inviteCreatedAt ? formatKst(member.inviteCreatedAt, "M/d HH:mm") : null}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">기다리는 사람이 없어요.</p>
          )}
        </section>
      )}

      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className="text-sm font-semibold text-muted-foreground">
          참여 중 {data.members.length}명
        </h2>
        <ul className="flex flex-col divide-y rounded-xl border">
          {data.members.map((member) => (
            <li key={member.id} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{member.nickname}</span>
                {member.role === "host" && <Badge variant="secondary">방장</Badge>}
                {member.id === me.id && <Badge variant="outline">나</Badge>}
              </span>
              {isHost && member.role !== "host" && (
                <KickButton sessionId={id} memberId={member.id} nickname={member.nickname} />
              )}
            </li>
          ))}
        </ul>
        {!isHost && <HostOnlyHint />}
      </section>

      <section aria-labelledby="leave-heading" className="mt-4 flex flex-col gap-3">
        <h2 id="leave-heading" className="sr-only">
          세션 나가기
        </h2>
        <LeaveSession sessionId={id} sessionName={data.sessionName} isHost={isHost} />
      </section>
    </>
  );
}
