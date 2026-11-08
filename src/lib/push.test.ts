import { sendNotification } from "web-push";
import { sendPush } from "./push";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeSupabase } from "@/test-utils/fake-supabase";

jest.mock("web-push", () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const SUB = { endpoint: "https://push.test/abc", p256dh: "k", auth: "a" };
const PAYLOAD = { title: "t", body: "b", url: "/" };

beforeAll(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendPush", () => {
  it("sends the JSON payload to the subscription", async () => {
    (sendNotification as jest.Mock).mockResolvedValue({});
    expect(await sendPush(SUB, PAYLOAD)).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, keys: { p256dh: "k", auth: "a" } },
      JSON.stringify(PAYLOAD),
      expect.objectContaining({ TTL: 1800 }),
    );
  });

  it.each([404, 410])("deletes a subscription the push service reports as gone (%i)", async (statusCode) => {
    const fake = fakeSupabase(() => ({}));
    (createAdminClient as jest.Mock).mockReturnValue(fake.client);
    (sendNotification as jest.Mock).mockRejectedValue({ statusCode });
    expect(await sendPush(SUB, PAYLOAD)).toBe(false);
    expect(fake.calls[0]).toMatchObject({ table: "push_subscriptions", op: "delete", filters: { "eq:endpoint": SUB.endpoint } });
  });

  it("keeps the subscription on transient errors", async () => {
    const fake = fakeSupabase(() => ({}));
    (createAdminClient as jest.Mock).mockReturnValue(fake.client);
    (sendNotification as jest.Mock).mockRejectedValue({ statusCode: 500 });
    expect(await sendPush(SUB, PAYLOAD)).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});
