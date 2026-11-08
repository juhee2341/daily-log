import { createTransferCode, redeemTransferCode } from "./transfer";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashTransferCode } from "@/lib/transfer-code";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getCurrentUserId: jest.fn(), requireUser: jest.fn() }));
jest.mock("@/lib/site-url", () => ({ getSiteUrl: jest.fn(async () => "https://daily-log.test") }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

function setup({ memberCount = 1, rpc = { data: { moved: 2, skipped: 0 }, error: null } } = {}) {
  const fake = fakeSupabase((c) => (c.table === "members" ? { count: memberCount } : {}));
  const rpcCalls: unknown[][] = [];
  (createAdminClient as jest.Mock).mockReturnValue({
    ...fake.client,
    rpc: (...args: unknown[]) => (rpcCalls.push(args), Promise.resolve(rpc)),
  });
  return { calls: fake.calls, rpcCalls };
}

const form = (code: string) => {
  const fd = new FormData();
  fd.set("code", code);
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentUserId as jest.Mock).mockResolvedValue("old");
  (requireUser as jest.Mock).mockResolvedValue("new");
});

describe("createTransferCode", () => {
  it("invalidates older codes and stores only the hash", async () => {
    const { calls } = setup();
    const result = await createTransferCode();
    if (!result.success) throw new Error("expected success");

    expect(result.data.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const raw = result.data.code.replace("-", "");
    expect(result.data.url).toBe(`https://daily-log.test/transfer?code=${raw}`);
    expect(calls[1]).toMatchObject({ table: "transfer_codes", op: "update", filters: { "eq:from_user_id": "old", "is:used_at": null } });
    expect(calls[2].payload).toMatchObject({ code_hash: hashTransferCode(raw), from_user_id: "old" });
    expect(JSON.stringify(calls[2].payload)).not.toContain(raw);
  });

  it("refuses when this device has no sessions", async () => {
    setup({ memberCount: 0 });
    expect(await createTransferCode()).toMatchObject({ success: false, code: "NOT_FOUND" });
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    expect(await createTransferCode()).toMatchObject({ success: false, code: "NOT_FOUND" });
  });
});

describe("redeemTransferCode", () => {
  it("moves memberships to this device via the transactional function", async () => {
    const { rpcCalls } = setup({ rpc: { data: { moved: 2, skipped: 1 }, error: null } });
    expect(await redeemTransferCode(form("abcd-2345"))).toEqual({ success: true, data: { moved: 2, skipped: 1 } });
    expect(rpcCalls[0]).toEqual(["transfer_identity", { p_code_hash: hashTransferCode("ABCD2345"), p_to: "new" }]);
  });

  it("rejects malformed codes before creating an identity", async () => {
    setup();
    expect(await redeemTransferCode(form("ABCD-234O"))).toMatchObject({ fieldErrors: { code: ["코드 8자리를 확인해주세요."] } });
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("explains invalid/expired codes and same-device use", async () => {
    setup({ rpc: { data: { error: "invalid" }, error: null } as never });
    expect(await redeemTransferCode(form("ABCD2345"))).toMatchObject({ code: "NOT_FOUND", error: expect.stringContaining("10분") });
    setup({ rpc: { data: { error: "same_device" }, error: null } as never });
    expect(await redeemTransferCode(form("ABCD2345"))).toMatchObject({ code: "VALIDATION_ERROR", error: expect.stringContaining("새 기기") });
  });
});
