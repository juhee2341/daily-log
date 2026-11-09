import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { getMySessions } from "@/lib/data/sessions";

export async function MySessionList() {
  const userId = await getCurrentUserId();
  const sessions = userId ? await getMySessions(userId) : [];

  if (!sessions.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        아직 참여 중인 세션이 없어요.
        <br />
        세션을 만들거나 초대 링크로 들어와 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="내 세션">
      {sessions.map((session) => {
        const pending = session.status === "pending";
        const card = (
          <Card className={pending ? "opacity-70" : "transition-colors hover:bg-muted/50"}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="truncate">{session.name}</CardTitle>
                {session.role === "host" && <Badge variant="secondary">방장</Badge>}
                {pending && <Badge variant="outline">승인 대기</Badge>}
              </div>
              <CardDescription>
                {pending
                  ? `${session.nickname}(으)로 참여 요청 중`
                  : `멤버 ${session.memberCount}명 · 오늘 ${session.todayPostCount}개`}
              </CardDescription>
            </CardHeader>
          </Card>
        );

        return (
          <li key={session.id}>
            {pending ? card : (
              <Link href={`/s/${session.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {card}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
