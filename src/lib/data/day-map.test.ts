import { getDayMap } from "./day-map";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const members = [
  { id: "host", nickname: "방장", role: "host", joined_at: "2026-11-08T00:00:00Z" },
  { id: "me", nickname: "민지", role: "member", joined_at: "2026-11-08T01:00:00Z" },
];
const posts = [
  { id: "p1", member_id: "host", slot_start: "2026-11-07T15:00:00Z" }, // KST 0시
  { id: "p2", member_id: "me", slot_start: "2026-11-08T05:00:00Z" }, // KST 14시
  { id: "p3", member_id: "host", slot_start: "2026-11-08T05:00:00Z" }, // KST 14시
  { id: "gone", member_id: "left-member", slot_start: "2026-11-08T06:00:00Z" },
];

beforeEach(() => {
  const fake = fakeSupabase((c) => (c.table === "members" ? { data: members } : { data: posts }));
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
});

describe("getDayMap", () => {
  const now = new Date("2026-11-08T05:37:00Z"); // KST 14:37

  it("buckets posts by KST hour, puts me first and totals each hour", async () => {
    const map = await getDayMap("s", "me", "today", now);
    expect(map.logDate).toBe("2026-11-08");
    expect(map.currentHour).toBe(14);
    expect(map.rows.map((r) => r.nickname)).toEqual(["민지", "방장"]);
    expect(map.rows[0].cells[14]).toBe("p2");
    expect(map.rows[1].cells[0]).toBe("p1");
    expect(map.rows[1].cells[14]).toBe("p3");
    expect(map.totals[14]).toBe(2);
    expect(map.totals[0]).toBe(1);
  });

  it("ignores posts from members who are no longer active", async () => {
    const map = await getDayMap("s", "me", "today", now);
    expect(map.totals[15]).toBe(0);
  });

  it("has no current hour on the yesterday tab", async () => {
    const map = await getDayMap("s", "me", "yesterday", now);
    expect(map.logDate).toBe("2026-11-07");
    expect(map.currentHour).toBeNull();
  });
});
