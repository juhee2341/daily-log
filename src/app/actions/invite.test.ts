import { requestJoin } from "./invite";
import { requireUser } from "@/lib/auth";
import { hashToken } from "@/lib/invite-token";
import { signalSession } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase, type FakeCall, type FakeResult } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireUser: jest.fn(), requireHost: jest.fn() }));
jest.mock("@/lib/realtime", () => ({ signalSession: jest.fn() }));
jest.mock("@/lib/site-url", () => ({ getSiteUrl: jest.fn(async () => "http://localhost:3000") }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const TOKEN = "A".repeat(32);
const INVITE = { id: "inv-1", session_id: "ses-1" };

function setup(overrides: (call: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = fakeSupabase((call) => {
    const custom = overrides(call);
    if (custom) return custom;
    if (call.table === "invites" && call.op === "select") return { data: INVITE };
    if (call.table === "members" && call.op === "select") return { data: null };
    if (call.table === "invites" && call.op === "update") return { data: [{ id: INVITE.id }] };
    return {};
  });
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

const form = (nickname: string, token = TOKEN) => {
  const fd = new FormData();
  fd.set("token", token);
  fd.set("nickname", nickname);
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (requireUser as jest.Mock).mockResolvedValue("user-2");
});

describe("requestJoin", () => {
  it("claims the invite atomically, adds a pending member and signals the host", async () => {
    const { calls } = setup();
    const result = await requestJoin(form(" 민지 "));

    expect(result).toEqual({ success: true, data: undefined });
    const lookup = calls.find((c) => c.table === "invites" && c.op === "select")!;
    expect(lookup.filters["eq:token_hash"]).toBe(hashToken(TOKEN));

    const claim = calls.find((c) => c.table === "invites" && c.op === "update")!;
    expect(claim.payload).toMatchObject({ status: "used", used_by: "user-2" });
    expect(claim.filters).toMatchObject({ "eq:id": "inv-1", "eq:status": "open" });
    expect(claim.filters["gt:expires_at"]).toEqual(expect.any(String));

    const insert = calls.find((c) => c.table === "members" && c.op === "insert")!;
    expect(insert.payload).toMatchObject({ session_id: "ses-1", user_id: "user-2", nickname: "민지", status: "pending", invite_id: "inv-1" });
    expect(signalSession).toHaveBeenCalledWith("ses-1", { type: "member.pending" });
  });

  it("rejects malformed tokens before touching auth", async () => {
    const result = await requestJoin(form("민지", "bad"));
    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an unknown token", async () => {
    setup((c) => (c.table === "invites" && c.op === "select" ? { data: null } : undefined));
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("does not consume the link when this device already belongs to the session", async () => {
    const { calls } = setup((c) =>
      c.table === "members" && c.op === "select" && c.filters["eq:user_id"] ? { data: { id: "m-1" } } : undefined,
    );
    expect(await requestJoin(form("민지"))).toEqual({ success: true, data: undefined });
    expect(calls.some((c) => c.table === "invites" && c.op === "update")).toBe(false);
  });

  it("returns a nickname field error when the nickname is taken", async () => {
    setup((c) =>
      c.table === "members" && c.op === "select" && c.filters["eq:nickname"] ? { data: { id: "m-9" } } : undefined,
    );
    const result = await requestJoin(form("민지"));
    expect(result).toMatchObject({ success: false, fieldErrors: { nickname: ["이 세션에서 이미 쓰는 닉네임이에요."] } });
  });

  it("fails when the link was already used or expired (claim matched nothing)", async () => {
    const { calls } = setup((c) => (c.table === "invites" && c.op === "update" ? { data: [] } : undefined));
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(calls.some((c) => c.table === "members" && c.op === "insert")).toBe(false);
  });

  it("reopens the link when the member insert hits a nickname race", async () => {
    const { calls } = setup((c) =>
      c.table === "members" && c.op === "insert" ? { error: { code: "23505", message: "dup" } } : undefined,
    );
    const result = await requestJoin(form("민지"));
    expect(result).toMatchObject({ success: false, fieldErrors: { nickname: ["이 세션에서 이미 쓰는 닉네임이에요."] } });
    const updates = calls.filter((c) => c.table === "invites" && c.op === "update");
    expect(updates[1].payload).toEqual({ status: "open", used_at: null, used_by: null });
    expect(signalSession).not.toHaveBeenCalled();
  });
});
