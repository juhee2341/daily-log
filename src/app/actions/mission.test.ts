import { setMission } from "./mission";
import { AuthError, requireHost } from "@/lib/auth";
import { signalSession } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { AuthError: actual.AuthError, requireHost: jest.fn() };
});
jest.mock("@/lib/realtime", () => ({ signalSession: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const SID = "6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50";

function setup() {
  const fake = fakeSupabase(() => ({}));
  const upserts: unknown[] = [];
  const client = {
    from: (table: string) => {
      const builder = fake.client.from(table) as Record<string, unknown>;
      builder.upsert = (payload: unknown) => {
        upserts.push(payload);
        return Promise.resolve({ error: null });
      };
      return builder;
    },
  };
  (createAdminClient as jest.Mock).mockReturnValue(client);
  return { calls: fake.calls, upserts };
}

const form = (body: string) => {
  const fd = new FormData();
  fd.set("sessionId", SID);
  fd.set("body", body);
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  (requireHost as jest.Mock).mockResolvedValue({});
});

describe("setMission", () => {
  it("upserts today's mission (KST date) and signals members", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-08T15:30:00Z"), doNotFake: ["queueMicrotask", "nextTick", "setImmediate"] });
    const { upserts } = setup();
    expect(await setMission(form("  점심 메뉴 찍기 "))).toEqual({ success: true, data: undefined });
    expect(upserts[0]).toMatchObject({ session_id: SID, log_date: "2026-11-09", body: "점심 메뉴 찍기" });
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "mission.updated" });
  });

  it("deletes today's mission when the body is empty", async () => {
    const { calls, upserts } = setup();
    await setMission(form("   "));
    expect(upserts).toHaveLength(0);
    expect(calls[0]).toMatchObject({ table: "missions", op: "delete", filters: { "eq:session_id": SID } });
  });

  it("rejects missions over 50 characters", async () => {
    setup();
    expect(await setMission(form("가".repeat(51)))).toMatchObject({ fieldErrors: { body: ["미션은 50자 이하로 입력해주세요."] } });
  });

  it("only lets the host set it", async () => {
    setup();
    (requireHost as jest.Mock).mockRejectedValue(new AuthError("UNAUTHORIZED", "방장만 할 수 있어요."));
    expect(await setMission(form("x"))).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(signalSession).not.toHaveBeenCalled();
  });
});
