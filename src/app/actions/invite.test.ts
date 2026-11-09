import { createInvite, requestJoin } from "./invite";
import { requireHost, requireUser } from "@/lib/auth";
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

describe("requestJoin with a group link (I-11)", () => {
  const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const GROUP = () => ({ ...INVITE, kind: "group", status: "open", expires_at: future() });

  it("adds a pending member without consuming the link", async () => {
    const { calls } = setup((c) => (c.table === "invites" && c.op === "select" ? { data: GROUP() } : undefined));
    expect(await requestJoin(form("민지"))).toEqual({ success: true, data: undefined });
    expect(calls.some((c) => c.table === "invites" && c.op === "update")).toBe(false);
    const insert = calls.find((c) => c.table === "members" && c.op === "insert")!;
    expect(insert.payload).toMatchObject({ invite_id: "inv-1", status: "pending", nickname: "민지" });
    expect(signalSession).toHaveBeenCalledWith("ses-1", { type: "member.pending" });
  });

  it("refuses a device the host already rejected on this link", async () => {
    const { calls } = setup((c) => {
      if (c.table === "invites" && c.op === "select") return { data: GROUP() };
      if (c.table === "invite_rejections") return { data: { invite_id: "inv-1" } };
      return undefined;
    });
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(calls.some((c) => c.table === "members" && c.op === "insert")).toBe(false);
  });

  it("refuses revoked or expired group links", async () => {
    setup((c) =>
      c.table === "invites" && c.op === "select"
        ? { data: { ...GROUP(), expires_at: new Date(Date.now() - 1000).toISOString() } }
        : undefined,
    );
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("treats a double submit from the same device as success, not a nickname clash", async () => {
    let inserted = false;
    setup((c) => {
      if (c.table === "invites" && c.op === "select") return { data: GROUP() };
      if (c.table === "members" && c.op === "insert") {
        inserted = true;
        return { error: { code: "23505", message: "dup" } };
      }
      if (c.table === "members" && c.filters["eq:user_id"]) return { data: inserted ? { id: "m-1" } : null };
      return undefined;
    });
    expect(await requestJoin(form("민지"))).toEqual({ success: true, data: undefined });
  });

  it("fails closed when the rejection check itself errors", async () => {
    const { calls } = setup((c) => {
      if (c.table === "invites" && c.op === "select") return { data: GROUP() };
      if (c.table === "invite_rejections") return { error: { message: "boom" } };
      return undefined;
    });
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "INTERNAL" });
    expect(calls.some((c) => c.table === "members" && c.op === "insert")).toBe(false);
  });

  it("caps how many people can wait on one group link", async () => {
    setup((c) => {
      if (c.table === "invites" && c.op === "select") return { data: GROUP() };
      if (c.table === "members" && c.filters["eq:invite_id"]) return { count: 50 };
      return undefined;
    });
    expect(await requestJoin(form("민지"))).toMatchObject({ success: false, code: "RATE_LIMITED" });
  });
});

describe("createInvite", () => {
  const SID = "6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50";
  const createForm = (kind?: string) => {
    const fd = new FormData();
    fd.set("sessionId", SID);
    fd.set("memo", "");
    if (kind !== undefined) fd.set("kind", kind);
    return fd;
  };

  beforeEach(() => (requireHost as jest.Mock).mockResolvedValue({}));

  it.each([
    [undefined, "single"],
    ["single", "single"],
    ["group", "group"],
  ])("stores kind=%s as %s", async (kind, stored) => {
    const { calls } = setup((c) =>
      c.table === "invites" && c.op === "insert" ? { data: { expires_at: "2026-11-10T00:00:00Z" } } : undefined,
    );
    const result = await createInvite(createForm(kind));
    expect(result).toMatchObject({ success: true, data: { kind: stored } });
    expect(calls.find((c) => c.op === "insert")!.payload).toMatchObject({ kind: stored });
  });

  it("rejects unknown kinds", async () => {
    expect(await createInvite(createForm("public"))).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});
