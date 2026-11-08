import { z } from "zod";

export const MISSION_MAX = 50;

/** S-7: 빈 문자열이면 미션을 지운다. */
export const setMissionSchema = z.object({
  sessionId: z.uuid(),
  body: z
    .string()
    .trim()
    .max(MISSION_MAX, `미션은 ${MISSION_MAX}자 이하로 입력해주세요.`),
});
