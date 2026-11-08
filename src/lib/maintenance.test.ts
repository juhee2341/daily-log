import { postIdFromPath, runDailyMaintenance } from "./maintenance";
import { signalSession } from "@/lib/realtime";
import { listObjects, removeMediaPrefix, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase, type FakeCall } from "@/test-utils/fake-supabase";

jest.mock("@/lib/realtime", () => ({ signalSession: jest.fn() }));
jest.mock("@/lib/storage", () => ({ listObjects: jest.fn(), removeObjects: jest.fn(), removeMediaPrefix: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";
// 2026-11-09 00:05 KST
const NOW = new Date("2026-11-08T15:05:00Z");

function setup(handler: (c: FakeCall) => object | undefined = () => undefined) {
  const fake = fakeSupabase((c) => handler(c) ?? (c.op === "delete" ? { data: [] } : { data: [] }));
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => {
  jest.clearAllMocks();
  (listObjects as jest.Mock).mockResolvedValue([]);
});

describe("postIdFromPath", () => {
  it("extracts the post id from media and thumbnail paths", () => {
    expect(postIdFromPath(`s/m/${P1}.mp4`)).toBe(P1);
    expect(postIdFromPath(`s/m/${P1}_thumb.jpg`)).toBe(P1);
    expect(postIdFromPath("s/m/random.txt")).toBeNull();
  });
});

describe("runDailyMaintenance", () => {
  it("deletes posts and missions older than yesterday (KST), with their files", async () => {
    const { calls } = setup((c) =>
      c.table === "posts" && c.op === "delete" ? { data: [{ media_path: "a.jpg", thumb_path: "a_thumb.jpg" }] } : undefined,
    );
    const result = await runDailyMaintenance(NOW);
    expect(calls.find((c) => c.table === "posts" && c.op === "delete")?.filters["lt:log_date"]).toBe("2026-11-08");
    expect(calls.find((c) => c.table === "missions")?.filters["lt:log_date"]).toBe("2026-11-08");
    expect(removeObjects).toHaveBeenCalledWith(["a.jpg", "a_thumb.jpg"]);
    expect(result.expiredPosts).toBe(1);
  });

  it("destroys sessions whose host has been away for 14 days, removing media and notifying members", async () => {
    const { calls } = setup((c) => (c.table === "sessions" ? { data: [{ id: "old-session" }] } : undefined));
    const result = await runDailyMaintenance(NOW);
    const cutoff = new Date(calls.find((c) => c.table === "sessions")!.filters["lt:host_last_seen"] as string);
    expect(cutoff.toISOString()).toBe("2026-10-25T15:05:00.000Z");
    expect(removeMediaPrefix).toHaveBeenCalledWith("old-session");
    expect(signalSession).toHaveBeenCalledWith("old-session", { type: "session.destroyed" });
    expect(result.destroyedSessions).toBe(1);
  });

  it("removes orphan files older than an hour but keeps fresh uploads and live posts", async () => {
    (listObjects as jest.Mock).mockResolvedValue([
      { path: `s/m/${P1}.jpg`, createdAt: "2026-11-08T10:00:00Z" }, // 포스트 있음 → 유지
      { path: `s/m/${P2}.mp4`, createdAt: "2026-11-08T10:00:00Z" }, // 고아, 오래됨 → 삭제
      { path: `s/m/${P3}.mp4`, createdAt: "2026-11-08T14:40:00Z" }, // 고아지만 25분 전 → 유지
    ]);
    setup((c) => (c.table === "posts" && c.op === "select" ? { data: [{ id: P1 }] } : undefined));
    const result = await runDailyMaintenance(NOW);
    expect(removeObjects).toHaveBeenLastCalledWith([`s/m/${P2}.mp4`]);
    expect(result.removedOrphanFiles).toBe(1);
  });

  it("cleans up expired tickets, transfer codes and week-old invites", async () => {
    const { calls } = setup();
    await runDailyMaintenance(NOW);
    expect(calls.find((c) => c.table === "capture_tickets")?.filters["lt:expires_at"]).toBe("2026-11-07T15:05:00.000Z");
    expect(calls.find((c) => c.table === "transfer_codes")?.filters["lt:expires_at"]).toBe("2026-11-07T15:05:00.000Z");
    expect(calls.find((c) => c.table === "invites")?.filters["lt:expires_at"]).toBe("2026-11-01T15:05:00.000Z");
  });
});
