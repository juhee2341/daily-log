import { deletePushSubscription, savePushSubscription, updateQuietHours } from "./push";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("@/lib/auth", () => ({ requireUser: jest.fn(), getCurrentUserId: jest.fn() }));
jest.mock("@/lib/push", () => ({ sendPush: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

function setup(result: { data?: unknown } = {}) {
  const fake = fakeSupabase(() => result);
  const upserts: unknown[] = [];
  (createAdminClient as jest.Mock).mockReturnValue({
    from: (t: string) => Object.assign(fake.client.from(t), { upsert: (p: unknown) => (upserts.push(p), Promise.resolve({ error: null })) }),
  });
  return { calls: fake.calls, upserts };
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireUser as jest.Mock).mockResolvedValue("u1");
  (getCurrentUserId as jest.Mock).mockResolvedValue("u1");
});

describe("savePushSubscription", () => {
  it("stores the subscription for this device with quiet hours", async () => {
    const { upserts } = setup();
    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" }, quietStart: 1, quietEnd: 8 });
    expect(result.success).toBe(true);
    expect(upserts[0]).toEqual({ user_id: "u1", endpoint: ENDPOINT, p256dh: "p", auth: "a", quiet_start: 1, quiet_end: 8 });
  });

  it("rejects non-https endpoints and bad hours", async () => {
    setup();
    expect((await savePushSubscription({ endpoint: "http://evil.test", keys: { p256dh: "p", auth: "a" }, quietStart: 1, quietEnd: 8 })).success).toBe(false);
    expect((await savePushSubscription({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" }, quietStart: 24, quietEnd: 8 })).success).toBe(false);
    expect(requireUser).not.toHaveBeenCalled();
  });
});

describe("deletePushSubscription / updateQuietHours", () => {
  it("only touches this device's own subscription", async () => {
    const { calls } = setup({ data: [{ id: "x" }] });
    await deletePushSubscription(ENDPOINT);
    await updateQuietHours(ENDPOINT, 23, 7);
    expect(calls[0]).toMatchObject({ op: "delete", filters: { "eq:endpoint": ENDPOINT, "eq:user_id": "u1" } });
    expect(calls[1]).toMatchObject({ op: "update", payload: { quiet_start: 23, quiet_end: 7 }, filters: { "eq:user_id": "u1" } });
  });

  it("reports NOT_FOUND when this device has no subscription", async () => {
    setup({ data: [] });
    expect(await updateQuietHours(ENDPOINT, 1, 8)).toMatchObject({ success: false, code: "NOT_FOUND" });
  });
});
