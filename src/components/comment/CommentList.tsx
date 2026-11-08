import { DeleteCommentButton } from "@/components/comment/DeleteCommentButton";
import type { PostComment } from "@/lib/data/timeline";
import { formatKst } from "@/lib/slot";

export function CommentList({ sessionId, comments }: { sessionId: string; comments: PostComment[] }) {
  if (!comments.length) return <p className="text-sm text-muted-foreground">첫 댓글을 남겨보세요.</p>;

  return (
    <ul className="flex flex-col gap-3" aria-label="댓글">
      {comments.map((c) => (
        <li key={c.id} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <strong className="font-semibold text-foreground">{c.nickname}</strong> · {formatKst(c.createdAt, "HH:mm")}
            </p>
            {c.deleted ? (
              <p className="text-sm text-muted-foreground italic">삭제된 댓글입니다</p>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
            )}
          </div>
          {c.isMine && !c.deleted && <DeleteCommentButton sessionId={sessionId} commentId={c.id} />}
        </li>
      ))}
    </ul>
  );
}
