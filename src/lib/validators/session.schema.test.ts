import { createSessionSchema, sessionIdSchema } from "./session.schema";

describe("createSessionSchema", () => {
  it("trims and accepts valid input", () => {
    expect(createSessionSchema.parse({ name: "  제주도  ", nickname: " 민지 " })).toEqual({
      name: "제주도",
      nickname: "민지",
    });
  });

  it("rejects a blank name after trimming", () => {
    const result = createSessionSchema.safeParse({ name: "   ", nickname: "민지" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.name).toEqual(["세션 이름을 입력해주세요."]);
  });

  it("rejects a name longer than 30 characters", () => {
    const result = createSessionSchema.safeParse({ name: "가".repeat(31), nickname: "민지" });
    expect(result.error?.flatten().fieldErrors.name).toEqual(["세션 이름은 30자 이하로 입력해주세요."]);
  });

  it("accepts boundary lengths", () => {
    expect(createSessionSchema.safeParse({ name: "가".repeat(30), nickname: "나".repeat(12) }).success).toBe(true);
  });

  it("rejects a nickname longer than 12 characters", () => {
    const result = createSessionSchema.safeParse({ name: "세션", nickname: "나".repeat(13) });
    expect(result.error?.flatten().fieldErrors.nickname).toEqual(["닉네임은 12자 이하로 입력해주세요."]);
  });

  it("rejects missing fields (FormData.get returns null)", () => {
    const result = createSessionSchema.safeParse({ name: null, nickname: null });
    expect(result.error?.flatten().fieldErrors).toEqual({
      name: ["세션 이름을 입력해주세요."],
      nickname: ["닉네임을 입력해주세요."],
    });
  });
});

describe("sessionIdSchema", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(sessionIdSchema.safeParse("6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50").success).toBe(true);
    expect(sessionIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
