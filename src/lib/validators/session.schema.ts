import { z } from "zod";

export const nicknameSchema = z
  .string({ error: "닉네임을 입력해주세요." })
  .trim()
  .min(1, "닉네임을 입력해주세요.")
  .max(12, "닉네임은 12자 이하로 입력해주세요.");

export const sessionNameSchema = z
  .string({ error: "세션 이름을 입력해주세요." })
  .trim()
  .min(1, "세션 이름을 입력해주세요.")
  .max(30, "세션 이름은 30자 이하로 입력해주세요.");

export const createSessionSchema = z.object({
  name: sessionNameSchema,
  nickname: nicknameSchema,
});

export const sessionIdSchema = z.uuid();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
