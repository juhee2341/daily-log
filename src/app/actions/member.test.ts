import { approveMember, kickMember, leaveSession, rejectMember } from "./member";
import { AuthError, requireHost, requireMember } from "@/lib/auth";
import { signalJoin, signalSession } from "@/lib/realtime";
import { removeMediaPrefix } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { fakeSupabase, type FakeCall, type FakeResult } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { AuthError: actual.AuthError, requireHost: jest.fn(), requireMember: jest.fn() };
});
jest.mock("@/lib/realtime", () => ({ signalJoin: jest.fn(), signalSession: jest.fn() }));
jest.mock("@/lib/storage", () => ({ removeMediaPrefix: jest.fn(async () => {}) }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const SID = "6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50";
const MID = "7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d";

function setup(handler: (call: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = fakeSupabase((call) => handler(call) ?? {});
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

const leaveForm = (confirmName?: string) => {
  const fd = new FormData();
  fd.set("sessionId", SID);
  if (confirmName !== undefined) fd.set("confirmName", confirmName);
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("approveMember", () => {
  it("activates a pending member and signals both channels", async () => {
    const { calls } = setup((c) => (c.op === "update" ? { data: [{ id: MID }] } : undefined));
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await approveMember(SID, MID)).toEqual({ success: true, data: undefined });
    expect(calls[0].filters).toMatchObject({ "eq:id": MID, "eq:session_id": SID, "eq:status": "pending" });
    expect(signalJoin).toHaveBeenCalledWith(MID, { type: "member.approved" });
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "member.joined" });
  });

  it("returns UNAUTHORIZED for non-hosts", async () => {
    setup();
    (requireHost as jest.Mock).mockRejectedValue(new AuthError("UNAUTHORIZED", "방장만 할 수 있어요."));
    expect(await approveMember(SID, MID)).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns NOT_FOUND when the request was already handled", async () => {
    setup((c) => (c.op === "update" ? { data: [] } : undefined));
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await approveMember(SID, MID)).toMatchObject({ success: false, code: "NOT_FOUND" });
  });
});

describe("rejectMember", () => {
  it("deletes the pending member, records the rejection and signals the requester", async () => {
    const { calls } = setup((c) => {
      if (c.op === "delete") return { data: [{ invite_id: "inv-1", user_id: "user-9" }] };
      if (c.table === "invites" && c.op === "select") return { data: { kind: "single" } };
      return undefined;
    });
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await rejectMember(SID, MID)).toEqual({ success: true, data: undefined });
    const mark = calls.find((c) => c.table === "invites" && c.op === "update")!;
    expect(mark.filters["eq:id"]).toBe("inv-1");
    expect(mark.payload).toEqual({ rejected_at: expect.any(String) });
    expect(signalJoin).toHaveBeenCalledWith(MID, { type: "member.rejected" });
  });

  it("keeps a group link alive and records the rejection per device (I-11)", async () => {
    const { calls } = setup((c) => {
      if (c.op === "delete") return { data: [{ invite_id: "inv-1", user_id: "user-9" }] };
      if (c.table === "invites" && c.op === "select") return { data: { kind: "group" } };
      return undefined;
    });
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await rejectMember(SID, MID)).toEqual({ success: true, data: undefined });
    expect(calls.some((c) => c.table === "invites" && c.op === "update")).toBe(false);
    const record = calls.find((c) => c.table === "invite_rejections")!;
    expect(record.op).toBe("upsert");
    expect(record.payload).toEqual({ invite_id: "inv-1", user_id: "user-9" });
  });
});

describe("kickMember", () => {
  it("only deletes active non-host members, then removes their media", async () => {
    const { calls } = setup((c) => (c.op === "delete" ? { data: [{ id: MID }] } : undefined));
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await kickMember(SID, MID)).toEqual({ success: true, data: undefined });
    expect(calls[0].filters).toMatchObject({ "eq:role": "member", "eq:status": "active" });
    expect(removeMediaPrefix).toHaveBeenCalledWith(`${SID}/${MID}`);
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "member.kicked", memberId: MID });
  });

  it("returns NOT_FOUND for the host or an already-removed member", async () => {
    setup((c) => (c.op === "delete" ? { data: [] } : undefined));
    (requireHost as jest.Mock).mockResolvedValue({});
    expect(await kickMember(SID, MID)).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(removeMediaPrefix).not.toHaveBeenCalled();
  });
});

describe("leaveSession", () => {
  it("lets a member leave, deleting only their own row and media", async () => {
    const { calls } = setup();
    (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID, role: "member" } });
    await leaveSession(leaveForm());
    expect(calls).toEqual([expect.objectContaining({ table: "members", op: "delete", filters: { "eq:id": MID } })]);
    expect(removeMediaPrefix).toHaveBeenCalledWith(`${SID}/${MID}`);
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "member.left", memberId: MID });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("refuses to destroy the session when the host mistypes the name", async () => {
    const { calls } = setup((c) => (c.table === "sessions" && c.op === "select" ? { data: { name: "제주도" } } : undefined));
    (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID, role: "host" } });
    const result = await leaveSession(leaveForm("제주"));
    expect(result).toMatchObject({ success: false, fieldErrors: { confirmName: ["세션 이름이 일치하지 않아요."] } });
    expect(calls.some((c) => c.op === "delete")).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("destroys the whole session when the host confirms the name", async () => {
    const { calls } = setup((c) => (c.table === "sessions" && c.op === "select" ? { data: { name: "제주도" } } : undefined));
    (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID, role: "host" } });
    await leaveSession(leaveForm(" 제주도 "));
    expect(calls.find((c) => c.op === "delete")).toMatchObject({ table: "sessions", filters: { "eq:id": SID } });
    expect(removeMediaPrefix).toHaveBeenCalledWith(SID);
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "session.destroyed" });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("still finishes when media cleanup fails (rows are already gone)", async () => {
    setup();
    (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID, role: "member" } });
    (removeMediaPrefix as jest.Mock).mockRejectedValueOnce(new Error("storage down"));
    await leaveSession(leaveForm());
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
