import { getJoinState } from "./invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase, type FakeCall, type FakeResult } from "@/test-utils/fake-supabase";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const NOW = new Date("2026-11-09T12:00:00Z");
const TOKEN = "A".repeat(32);
const invite = (over: Record<string, unknown> = {}) => ({
  id: "inv-1",
  session_id: "ses-1",
  kind: "single",
  status: "open",
  expires_at: "2026-11-10T00:00:00Z",
  used_by: null,
  rejected_at: null,
  ...over,
});

function setup(inviteRow: ReturnType<typeof invite>, extra: (call: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = fakeSupabase((call) => {
    const custom = extra(call);
    if (custom) return custom;
    if (call.table === "invites") return { data: inviteRow };
    if (call.table === "sessions") return { data: { id: "ses-1", name: "MT" } };
    return { data: null };
  });
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

describe("getJoinState", () => {
  it("marks open group links so the form can explain they are shared", async () => {
    setup(invite({ kind: "group" }));
    expect(await getJoinState(TOKEN, "u1", NOW)).toEqual({ kind: "open", sessionName: "MT", group: true });
  });

  it("shows the rejection to a device rejected on a group link, even though the link is still open", async () => {
    setup(invite({ kind: "group" }), (c) => (c.table === "invite_rejections" ? { data: { invite_id: "inv-1" } } : undefined));
    expect(await getJoinState(TOKEN, "u1", NOW)).toEqual({ kind: "rejected", sessionName: "MT", group: true });
  });

  it("does not look up group rejections for single links", async () => {
    const { calls } = setup(invite());
    expect(await getJoinState(TOKEN, "u1", NOW)).toEqual({ kind: "open", sessionName: "MT", group: false });
    expect(calls.some((c) => c.table === "invite_rejections")).toBe(false);
  });

  it("still reports used single links", async () => {
    setup(invite({ status: "used", used_by: "someone-else" }));
    expect(await getJoinState(TOKEN, "u1", NOW)).toEqual({ kind: "used" });
  });

  it("returns pending for a device already waiting", async () => {
    setup(invite({ kind: "group" }), (c) =>
      c.table === "members" ? { data: { id: "m1", status: "pending", nickname: "민지" } } : undefined,
    );
    expect(await getJoinState(TOKEN, "u1", NOW)).toEqual({ kind: "pending", sessionName: "MT", nickname: "민지", memberId: "m1" });
  });
});
