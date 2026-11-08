import { requireHost, requireMember } from "./auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

function setup(member: { id: string; role: "host" | "member" } | null) {
  (createClient as jest.Mock).mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) } });
  const fake = fakeSupabase((c) => (c.table === "members" ? { data: member } : {}));
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

describe("requireMember", () => {
  it("records host activity (throttled) when the host merely views the session", async () => {
    const { calls } = setup({ id: "m1", role: "host" });
    await requireMember("s1");
    const touch = calls.find((c) => c.table === "sessions")!;
    expect(touch.op).toBe("update");
    expect(touch.filters["eq:id"]).toBe("s1");
    const threshold = new Date(touch.filters["lt:host_last_seen"] as string).getTime();
    expect(Date.now() - threshold).toBeGreaterThanOrEqual(60 * 60 * 1000 - 50);
  });

  it("does not touch the session for regular members", async () => {
    const { calls } = setup({ id: "m2", role: "member" });
    await requireMember("s1");
    expect(calls.some((c) => c.table === "sessions")).toBe(false);
  });

  it("throws NOT_FOUND for non-members", async () => {
    setup(null);
    await expect(requireMember("s1")).rejects.toMatchObject({ name: "AuthError", code: "NOT_FOUND" });
  });
});

describe("requireHost", () => {
  it("rejects regular members", async () => {
    setup({ id: "m2", role: "member" });
    await expect(requireHost("s1")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
