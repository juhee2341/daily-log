import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CancelPostButton } from "@/components/post/CancelPostButton";
import { SessionSignalRefresher } from "@/components/session/SessionSignalRefresher";
import { Button } from "@/components/ui/button";
import { AuthError, requireMember } from "@/lib/auth";
import { getPostDetail } from "@/lib/data/timeline";
import { formatKst } from "@/lib/slot";
import { postRefSchema } from "@/lib/validators/post.schema";

export const metadata: Metadata = { title: "포스트" };

export default function PostPage({ params }: PageProps<"/s/[id]/p/[postId]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <PostContent params={params} />
      </Suspense>
    </main>
  );
}

async function PostContent({ params }: { params: PageProps<"/s/[id]/p/[postId]">["params"] }) {
  const { id, postId } = await params;
  if (!postRefSchema.safeParse({ sessionId: id, postId }).success) notFound();

  let memberId: string;
  try {
    memberId = (await requireMember(id)).member.id;
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  const post = await getPostDetail(id, postId, memberId);
  if (!post) notFound();

  return (
    <>
      <SessionSignalRefresher sessionId={id} myMemberId={memberId} />
      <nav>
        <Link href={`/s/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 타임라인
        </Link>
      </nav>

      <figure className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-2xl bg-black">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="max-h-[70dvh] w-full object-contain" controls playsInline autoPlay loop muted aria-label={`${post.nickname}의 영상`} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 서명 URL
            <img src={post.mediaUrl} alt={`${post.nickname}의 사진`} className="max-h-[70dvh] w-full object-contain" />
          )}
        </div>
        <figcaption className="flex flex-col gap-1">
          <p className="text-sm">
            <strong>{post.nickname}</strong>
            <span className="text-muted-foreground">
              {" "}
              · {formatKst(post.slotStart, "M월 d일 HH:00")} 슬롯 · {formatKst(post.createdAt, "HH:mm")} 올림
            </span>
          </p>
          {post.caption && <p className="text-base whitespace-pre-wrap break-words">{post.caption}</p>}
        </figcaption>
      </figure>

      {post.isMine && (
        <div className="flex flex-col gap-2">
          {post.cancelUntil && <CancelPostButton sessionId={id} postId={post.id} until={post.cancelUntil} />}
          {post.downloadUrl && (
            <Button asChild variant="ghost">
              <a href={post.downloadUrl}>원본 저장</a>
            </Button>
          )}
        </div>
      )}

      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">댓글은 다음 단계에서 붙어요.</p>
    </>
  );
}
