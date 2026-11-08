import { isAuthorizedCron } from "./cron-auth";

const req = (auth?: string) => new Request("https://x.test/api/cron/daily", { method: "POST", headers: auth ? { authorization: auth } : {} });

describe("isAuthorizedCron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
  });

  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCron(req("Bearer s3cret"))).toBe(true);
  });

  it("rejects missing, wrong or differently sized secrets", () => {
    expect(isAuthorizedCron(req())).toBe(false);
    expect(isAuthorizedCron(req("Bearer nope00"))).toBe(false);
    expect(isAuthorizedCron(req("Bearer s3cret-extra"))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron(req("Bearer "))).toBe(false);
  });
});
