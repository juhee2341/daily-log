"use client";

import { useActionState, useRef, useState } from "react";
import { addComment } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { cn } from "@/lib/utils";
import { COMMENT_MAX } from "@/lib/validators/comment.schema";

type State = Awaited<ReturnType<typeof addComment>> | null;

export function CommentForm({ sessionId, postId }: { sessionId: string; postId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [length, setLength] = useState(0);
  // 다른 화면에 다녀오면 지난 에러는 지운다 (입력 중이던 글은 그대로 둔다)
  const { stale, markFresh } = useResetOnHide();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    markFresh();
    const result = await addComment(formData);
    if (result.success) {
      formRef.current?.reset();
      setLength(0);
    }
    return result;
  }, null);
  const failed = !stale && state && !state.success ? state : null;
  const error = failed?.fieldErrors?.body?.[0] ?? failed?.error;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1.5" noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="comment-body" className="sr-only">
        댓글
      </label>
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            id="comment-body"
            name="body"
            rows={1}
            placeholder="댓글 달기"
            required
            onChange={(e) => setLength(e.target.value.length)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "comment-error" : undefined}
            className="field-sizing-content max-h-32 min-h-10 w-full resize-none rounded-xl border bg-background px-3 py-2 pr-12 text-base focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span
            className={cn(
              "absolute right-2.5 bottom-2 text-[10px] tabular-nums",
              length > COMMENT_MAX ? "text-destructive" : "text-muted-foreground",
            )}
            aria-hidden
          >
            {length}/{COMMENT_MAX}
          </span>
        </div>
        <Button type="submit" className="h-10" disabled={pending || length === 0 || length > COMMENT_MAX}>
          {pending ? "..." : "등록"}
        </Button>
      </div>
      {error && (
        <p id="comment-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
