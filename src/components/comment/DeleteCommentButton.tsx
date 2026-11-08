"use client";

import { deleteComment } from "@/app/actions/comment";
import { ConfirmButton } from "@/components/common/ConfirmButton";

export function DeleteCommentButton({ sessionId, commentId }: { sessionId: string; commentId: string }) {
  return (
    <ConfirmButton
      label="삭제"
      confirmLabel="삭제"
      question="댓글을 삭제할까요?"
      variant="ghost"
      onConfirm={() => deleteComment(sessionId, commentId)}
    />
  );
}
