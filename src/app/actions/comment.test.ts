import { addComment, deleteComment } from "./comment";
import { AuthError, requireMember } from "@/lib/auth";
import { signalSession } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase, type FakeCall, type FakeResult } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { AuthError: actual.AuthError, requireMember: jest.fn() };
});
jest.mock("@/lib/realtime", () => ({ signalSession: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const SID = "6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50";
const PID = "9c4d5e6f-3a4b-4c7d-8e1f-2a3b4c5d6e7f";
const CID = "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a";
const MID = "7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d";

function setup(handler: (c: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = fakeSupabase((c) => {
    const custom = handler(c);
    if (custom) return custom;
    if (c.table === "posts") return { data: { id: PID } };
    if (c.table === "comments" && c.op === "select") return { count: 0 };
    return {};
  });
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return fake;
}

const form = (body: string) => {
  const fd = new FormData();
  fd.set("sessionId", SID);
  fd.set("postId", PID);
  fd.set("body", body);
  return fd;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID } });
});

describe("addComment", () => {
  it("inserts a trimmed comment and signals the post", async () => {
    const { calls } = setup();
    expect(await addComment(form("  좋다!  "))).toEqual({ success: true, data: undefined });
    const insert = calls.find((c) => c.table === "comments" && c.op === "insert")!;
    expect(insert.payload).toEqual({ post_id: PID, member_id: MID, body: "좋다!" });
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "comment.created", postId: PID });
  });

  it("rejects blank and over-100-character comments", async () => {
    setup();
    expect(await addComment(form("   "))).toMatchObject({ fieldErrors: { body: ["댓글을 입력해주세요."] } });
    expect(await addComment(form("가".repeat(101)))).toMatchObject({ fieldErrors: { body: ["댓글은 100자 이하로 입력해주세요."] } });
    expect(requireMember).not.toHaveBeenCalled();
  });

  it("refuses non-members", async () => {
    setup();
    (requireMember as jest.Mock).mockRejectedValue(new AuthError("NOT_FOUND", "세션을 찾을 수 없거나 참여 중이 아니에요."));
    expect(await addComment(form("hi"))).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("refuses posts outside the session (or already gone)", async () => {
    const { calls } = setup((c) => (c.table === "posts" ? { data: null } : undefined));
    expect(await addComment(form("hi"))).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("rate-limits bursts", async () => {
    setup((c) => (c.table === "comments" && c.op === "select" ? { count: 20 } : undefined));
    expect(await addComment(form("hi"))).toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("deleteComment", () => {
  it("soft-deletes only my undeleted comment, leaving a trace", async () => {
    const { calls } = setup((c) => (c.op === "update" ? { data: [{ post_id: PID }] } : undefined));
    expect(await deleteComment(SID, CID)).toEqual({ success: true, data: undefined });
    expect(calls[0].payload).toEqual({ body: null, deleted_at: expect.any(String) });
    expect(calls[0].filters).toMatchObject({ "eq:id": CID, "eq:member_id": MID, "is:deleted_at": null });
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "comment.deleted", postId: PID });
  });

  it("returns NOT_FOUND for someone else's or an already-deleted comment", async () => {
    setup((c) => (c.op === "update" ? { data: [] } : undefined));
    expect(await deleteComment(SID, CID)).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(signalSession).not.toHaveBeenCalled();
  });
});
