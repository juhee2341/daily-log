import { createSession } from "./session";
import { AuthError, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { AuthError: actual.AuthError, requireUser: jest.fn() };
});
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

type Result = { data?: unknown; error?: unknown; count?: number | null };

/** supabase-js 체이닝을 흉내 내는 최소 가짜. 테이블·동작별로 결과를 지정한다. */
function fakeAdmin(results: {
  countRecent?: Result;
  insertSession?: Result;
  insertMember?: Result;
}) {
  const deleted: string[] = [];
  const chain = (result: Result) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "single"]) c[m] = () => c;
    c.then = (resolve: (r: Result) => unknown) => resolve(result);
    return c;
  };
  const client = {
    from(table: string) {
      return {
        select: () => chain(results.countRecent ?? { count: 0, error: null }),
        insert: () =>
          table === "sessions"
            ? chain(results.insertSession ?? { data: { id: "s-1" }, error: null })
            : chain(results.insertMember ?? { error: null }),
        delete: () => ({
          eq: (_col: string, id: string) => {
            deleted.push(id);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
  (createAdminClient as jest.Mock).mockReturnValue(client);
  return { deleted };
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (requireUser as jest.Mock).mockResolvedValue("user-1");
});

describe("createSession", () => {
  it("creates the session and host member, then redirects to it", async () => {
    fakeAdmin({});
    await createSession(form({ name: "제주도", nickname: "민지" }));
    expect(redirect).toHaveBeenCalledWith("/s/s-1");
  });

  it("returns field errors without touching auth when input is invalid", async () => {
    const result = await createSession(form({ name: "", nickname: "나".repeat(13) }));
    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(result.success === false && result.fieldErrors).toMatchObject({
      name: ["세션 이름을 입력해주세요."],
      nickname: ["닉네임은 12자 이하로 입력해주세요."],
    });
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED when an anonymous identity cannot be created", async () => {
    (requireUser as jest.Mock).mockRejectedValue(new AuthError("UNAUTHORIZED", "기기 신원을 만들지 못했어요."));
    const result = await createSession(form({ name: "제주도", nickname: "민지" }));
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED", error: "기기 신원을 만들지 못했어요.", fieldErrors: undefined });
  });

  it("rate-limits after 5 sessions in an hour", async () => {
    fakeAdmin({ countRecent: { count: 5, error: null } });
    const result = await createSession(form({ name: "제주도", nickname: "민지" }));
    expect(result).toMatchObject({ success: false, code: "RATE_LIMITED" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns INTERNAL when the session insert fails", async () => {
    fakeAdmin({ insertSession: { data: null, error: { message: "db down" } } });
    const result = await createSession(form({ name: "제주도", nickname: "민지" }));
    expect(result).toMatchObject({ success: false, code: "INTERNAL" });
  });

  it("rolls back the session when the host member insert fails", async () => {
    const { deleted } = fakeAdmin({ insertMember: { error: { message: "conflict" } } });
    const result = await createSession(form({ name: "제주도", nickname: "민지" }));
    expect(result).toMatchObject({ success: false, code: "INTERNAL" });
    expect(deleted).toEqual(["s-1"]);
    expect(redirect).not.toHaveBeenCalled();
  });
});
