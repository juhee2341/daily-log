import { z } from "zod";

export const COMMENT_MAX = 100;

export const addCommentSchema = z.object({
  sessionId: z.uuid(),
  postId: z.uuid(),
  body: z
    .string({ error: "댓글을 입력해주세요." })
    .trim()
    .min(1, "댓글을 입력해주세요.")
    .max(COMMENT_MAX, `댓글은 ${COMMENT_MAX}자 이하로 입력해주세요.`),
});

export const commentRefSchema = z.object({
  sessionId: z.uuid(),
  commentId: z.uuid(),
});
