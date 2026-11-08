import { http, HttpResponse } from "msw";
import { cancelPost, issueCaptureTicket, publishPost } from "./post";
import { requireMember } from "@/lib/auth";
import { signalSession } from "@/lib/realtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { server } from "@/mocks/server";
import { fakeSupabase, type FakeCall, type FakeResult } from "@/test-utils/fake-supabase";

jest.mock("next/cache", () => ({ refresh: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireMember: jest.fn() }));
jest.mock("@/lib/realtime", () => ({ signalSession: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const SID = "6f1c2a5e-8b9d-4c3e-a1f2-0b1c2d3e4f50";
const MID = "7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d";
const TID = "8b3c4d5e-2f3a-4b6c-9d0e-1f2a3b4c5d6e";
const PID = "9c4d5e6f-3a4b-4c7d-8e1f-2a3b4c5d6e7f";
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const MP4 = [0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70];

function setup(handler: (c: FakeCall) => FakeResult | undefined = () => undefined, sizes: Record<string, number> = {}) {
  const storage = {
    createSignedUploadUrl: jest.fn(async (path: string) => ({ data: { token: `tok:${path}`, path, signedUrl: "x" }, error: null })),
    info: jest.fn(async (path: string) => ({ data: { size: sizes[path] ?? 1000 }, error: null })),
    createSignedUrl: jest.fn(async (path: string) => ({ data: { signedUrl: `https://storage.test/${path}` }, error: null })),
    remove: jest.fn(async () => ({ data: [], error: null })),
  };
  const fake = fakeSupabase((c) => handler(c) ?? {}, storage as never);
  (createAdminClient as jest.Mock).mockReturnValue(fake.client);
  return { ...fake, storage };
}

function serveBytes(map: Record<string, number[]>) {
  server.use(
    http.get("https://storage.test/*", ({ request }) => {
      const path = new URL(request.url).pathname.slice(1);
      return new HttpResponse(new Uint8Array(map[path] ?? [0, 1, 2, 3, 4, 5, 6, 7]));
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (requireMember as jest.Mock).mockResolvedValue({ member: { id: MID } });
});

describe("issueCaptureTicket", () => {
  it("locks the slot by server time and returns signed upload tokens", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-08T05:37:12Z"), doNotFake: ["queueMicrotask", "nextTick", "setImmediate"] });
    const { calls, storage } = setup((c) =>
      c.table === "capture_tickets" && c.op === "insert" ? { data: { id: TID } } : c.table === "capture_tickets" ? { count: 0 } : undefined,
    );
    const result = await issueCaptureTicket({ sessionId: SID, mimeType: "video/mp4" });

    expect(result.success).toBe(true);
    const insert = calls.find((c) => c.table === "capture_tickets" && c.op === "insert")!;
    expect(insert.payload).toMatchObject({ member_id: MID, slot_start: "2026-11-08T05:00:00.000Z" });
    const postId = (insert.payload as { post_id: string }).post_id;
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(`${SID}/${MID}/${postId}.mp4`);
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(`${SID}/${MID}/${postId}_thumb.jpg`);
  });

  it("refuses when this member already posted in the current slot", async () => {
    setup((c) => (c.table === "posts" ? { data: { id: PID } } : undefined));
    const result = await issueCaptureTicket({ sessionId: SID, mimeType: "image/jpeg" });
    expect(result).toMatchObject({ success: false, error: expect.stringContaining("이미 올렸어요") });
  });

  it("rate-limits retakes within one slot", async () => {
    setup((c) => (c.table === "capture_tickets" ? { count: 10 } : undefined));
    expect(await issueCaptureTicket({ sessionId: SID, mimeType: "image/jpeg" })).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects unsupported mime types", async () => {
    setup();
    expect(await issueCaptureTicket({ sessionId: SID, mimeType: "image/png" as never })).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("publishPost", () => {
  const ticket = (over: Record<string, unknown> = {}) => ({
    id: TID,
    member_id: MID,
    slot_start: "2026-11-08T15:00:00.000Z", // KST 11/9 00:00 — log_date는 KST 기준이어야 한다
    post_id: PID,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used: false,
    ...over,
  });
  const base = (t = ticket()) => (c: FakeCall): FakeResult | undefined => {
    if (c.table === "capture_tickets" && c.op === "select") return { data: t };
    if (c.table === "capture_tickets" && c.op === "update") return { data: [{ id: TID }] };
    if (c.table === "members") return { data: { session_id: SID } };
    return undefined;
  };

  it("verifies the upload and inserts the post into the ticket's slot", async () => {
    serveBytes({ [`${SID}/${MID}/${PID}.mp4`]: MP4, [`${SID}/${MID}/${PID}_thumb.jpg`]: JPEG });
    const { calls } = setup(base());
    const result = await publishPost({ ticketId: TID, mimeType: "video/mp4", caption: "  안녕 ", durationMs: 10_300 });

    expect(result).toEqual({ success: true, data: { postId: PID } });
    const insert = calls.find((c) => c.table === "posts" && c.op === "insert")!;
    expect(insert.payload).toMatchObject({
      id: PID,
      slot_start: "2026-11-08T15:00:00.000Z",
      log_date: "2026-11-09",
      media_type: "video",
      duration_ms: 10_000,
      caption: "안녕",
    });
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "post.created" });
  });

  it("rejects an expired ticket (more than 5 minutes after the shutter)", async () => {
    setup(base(ticket({ expires_at: new Date(Date.now() - 1).toISOString() })));
    expect(await publishPost({ ticketId: TID, mimeType: "image/jpeg" })).toMatchObject({
      success: false,
      error: expect.stringContaining("5분"),
    });
  });

  it("rejects someone else's ticket", async () => {
    setup(base(ticket({ member_id: "other" })));
    expect(await publishPost({ ticketId: TID, mimeType: "image/jpeg" })).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes the upload and refuses when the bytes are not the declared type", async () => {
    serveBytes({ [`${SID}/${MID}/${PID}.jpg`]: [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0] });
    const { calls, storage } = setup(base());
    const result = await publishPost({ ticketId: TID, mimeType: "image/jpeg" });
    expect(result).toMatchObject({ success: false, error: "지원하지 않는 파일 형식이에요." });
    expect(storage.remove).toHaveBeenCalledWith([`${SID}/${MID}/${PID}.jpg`, `${SID}/${MID}/${PID}_thumb.jpg`]);
    expect(calls.some((c) => c.table === "posts")).toBe(false);
  });

  it("refuses oversized files", async () => {
    serveBytes({ [`${SID}/${MID}/${PID}.jpg`]: JPEG });
    setup(base(), { [`${SID}/${MID}/${PID}.jpg`]: 6 * 1024 * 1024 });
    expect(await publishPost({ ticketId: TID, mimeType: "image/jpeg" })).toMatchObject({ error: "파일이 너무 커요." });
  });

  it("requires a duration for videos and enforces the 2s minimum", async () => {
    setup(base());
    expect(await publishPost({ ticketId: TID, mimeType: "video/mp4" })).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await publishPost({ ticketId: TID, mimeType: "video/mp4", durationMs: 1500 })).toMatchObject({
      fieldErrors: { durationMs: ["영상은 2초 이상이어야 해요."] },
    });
  });

  it("rejects captions over 100 characters", async () => {
    setup(base());
    expect(await publishPost({ ticketId: TID, mimeType: "image/jpeg", caption: "가".repeat(101) })).toMatchObject({
      fieldErrors: { caption: ["코멘트는 100자 이하로 입력해주세요."] },
    });
  });
});

describe("cancelPost", () => {
  it("deletes my post only within 3 minutes, along with its files", async () => {
    const { calls, storage } = setup((c) =>
      c.op === "delete" ? { data: [{ media_path: "a.jpg", thumb_path: "a_thumb.jpg" }] } : undefined,
    );
    expect(await cancelPost(SID, PID)).toEqual({ success: true, data: undefined });
    const del = calls[0];
    expect(del.filters).toMatchObject({ "eq:id": PID, "eq:session_id": SID, "eq:member_id": MID });
    const cutoff = new Date(del.filters["gt:created_at"] as string).getTime();
    expect(Date.now() - cutoff).toBeGreaterThanOrEqual(3 * 60 * 1000 - 50);
    expect(storage.remove).toHaveBeenCalledWith(["a.jpg", "a_thumb.jpg"]);
    expect(signalSession).toHaveBeenCalledWith(SID, { type: "post.deleted" });
  });

  it("returns NOT_FOUND after the window (or for someone else's post)", async () => {
    setup((c) => (c.op === "delete" ? { data: [] } : undefined));
    expect(await cancelPost(SID, PID)).toMatchObject({ success: false, code: "NOT_FOUND" });
  });
});
