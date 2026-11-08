import { z } from "zod";
import { nicknameSchema } from "./session.schema";

export const inviteMemoSchema = z
  .string()
  .trim()
  .max(20, "메모는 20자 이하로 입력해주세요.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const createInviteSchema = z.object({
  sessionId: z.uuid(),
  memo: inviteMemoSchema,
});

export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/, "올바르지 않은 링크예요.");

export const requestJoinSchema = z.object({
  token: inviteTokenSchema,
  nickname: nicknameSchema,
});

export const sessionMemberSchema = z.object({
  sessionId: z.uuid(),
  memberId: z.uuid(),
});

export const sessionInviteSchema = z.object({
  sessionId: z.uuid(),
  inviteId: z.uuid(),
});

export const leaveSessionSchema = z.object({
  sessionId: z.uuid(),
  confirmName: z.string().optional(),
});
