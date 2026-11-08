import { dispatchSlotReminders } from "./push-reminders";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase, type FakeCall } from "@/test-utils/fake-supabase";

jest.mock("@/lib/push", () => ({ sendPush: jest.fn(async () => true) }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const sub = (user: string, quiet: [number, number] = [1, 8]) => ({
  user_id: user,
  endpoint: `https://push.test/${user}`,
  p256dh: "k",
  auth: "a",
  quiet_start: quiet[0],
  quiet_end: quiet[1],
});

function setup(data: { subs: unknown[]; members: unknown[]; posted?: unknown[]; sessions?: unknown[] }) {
  const fake = fakeSupabase((c: FakeCall) => {
    if (c.table === "push_subscriptions") return { data: data.subs };
    if (c.table === "members") return { data: data.members };
    if (c.table === "posts") return { data: data.posted ?? [] };
    if (c.table === "sessions") return { data: data.sessions ?? [{ id: "s1", name: "제주도" }, { id: "s2", name: "MT" }] };
    return {};
  });
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

// KST 15:00 정각
const at15 = new Date("2026-11-08T06:00:00Z");

beforeEach(() => jest.clearAllMocks());

describe("dispatchSlotReminders", () => {
  it("reminds members of sessions they haven't posted to this slot, linking straight to capture", async () => {
    const { calls } = setup({ subs: [sub("u1")], members: [{ id: "m1", user_id: "u1", session_id: "s1" }] });
    const result = await dispatchSlotReminders(at15);

    expect(result).toEqual({ candidates: 1, sent: 1, skippedQuiet: 0, skippedPosted: 0 });
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.test/u1" }), {
      title: "지금 찍을 시간이에요 📸",
      body: "제주도 · 15:00",
      url: "/s/s1/capture",
      tag: "slot-2026-11-08T06:00:00.000Z",
    });
    expect(calls.find((c) => c.table === "posts")?.filters["eq:slot_start"]).toBe("2026-11-08T06:00:00.000Z");
  });

  it("summarises multiple sessions and links home", async () => {
    setup({
      subs: [sub("u1")],
      members: [
        { id: "m1", user_id: "u1", session_id: "s1" },
        { id: "m2", user_id: "u1", session_id: "s2" },
      ],
    });
    await dispatchSlotReminders(at15);
    expect(sendPush).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ body: "제주도 외 1개 세션 · 15:00", url: "/" }));
  });

  it("skips subscriptions in their quiet hours (KST)", async () => {
    setup({ subs: [sub("u1", [14, 16]), sub("u2", [22, 7])], members: [{ id: "m2", user_id: "u2", session_id: "s1" }] });
    const result = await dispatchSlotReminders(at15);
    expect(result.skippedQuiet).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.test/u2" }), expect.anything());
  });

  it("skips users who already posted everywhere, or have no sessions", async () => {
    setup({
      subs: [sub("u1"), sub("lonely")],
      members: [{ id: "m1", user_id: "u1", session_id: "s1" }],
      posted: [{ member_id: "m1" }],
    });
    const result = await dispatchSlotReminders(at15);
    expect(result.skippedPosted).toBe(2);
    expect(sendPush).not.toHaveBeenCalled();
  });
});
