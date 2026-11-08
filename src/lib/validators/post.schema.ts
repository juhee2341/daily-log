import { z } from "zod";
import { CAPTION_MAX, MEDIA_MIMES, VIDEO_MAX_MS, VIDEO_MIN_MS } from "@/lib/media";

export const issueTicketSchema = z.object({
  sessionId: z.uuid(),
  mimeType: z.enum(MEDIA_MIMES),
});

export const publishPostSchema = z.object({
  ticketId: z.uuid(),
  mimeType: z.enum(MEDIA_MIMES),
  caption: z
    .string()
    .trim()
    .max(CAPTION_MAX, `코멘트는 ${CAPTION_MAX}자 이하로 입력해주세요.`)
    .optional()
    .transform((v) => (v ? v : null)),
  durationMs: z
    .number()
    .int()
    .min(VIDEO_MIN_MS, "영상은 2초 이상이어야 해요.")
    .max(VIDEO_MAX_MS + 500, "영상은 10초 이하여야 해요.")
    .optional(),
});

export const postRefSchema = z.object({
  sessionId: z.uuid(),
  postId: z.uuid(),
});

export const dayParamSchema = z.enum(["today", "yesterday"]).catch("today");

export type IssueTicketInput = z.input<typeof issueTicketSchema>;
export type PublishPostInput = z.input<typeof publishPostSchema>;
