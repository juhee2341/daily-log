import {
  getKstHour,
  getLogDate,
  getRetainedDates,
  getSlotStart,
  isQuietHour,
  msUntilNextSlot,
} from "./slot";

// 2026-11-08 14:37:12 KST = 05:37:12 UTC
const afternoon = new Date("2026-11-08T05:37:12.345Z");
// 2026-11-09 00:10 KST = 2026-11-08 15:10 UTC (UTC로는 아직 전날)
const justAfterMidnight = new Date("2026-11-08T15:10:00.000Z");

describe("getSlotStart", () => {
  it("returns the KST hour boundary containing the time", () => {
    expect(getSlotStart(afternoon).toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });

  it("returns the same instant when already on the boundary", () => {
    const boundary = new Date("2026-11-08T05:00:00.000Z");
    expect(getSlotStart(boundary).toISOString()).toBe(boundary.toISOString());
  });

  it("returns a plain Date", () => {
    expect(getSlotStart(afternoon).constructor).toBe(Date);
  });
});

describe("msUntilNextSlot", () => {
  it("returns the time left until the next hour", () => {
    expect(msUntilNextSlot(afternoon)).toBe((22 * 60 + 47) * 1000 + 655);
  });

  it("returns a full hour on the boundary", () => {
    expect(msUntilNextSlot(new Date("2026-11-08T05:00:00.000Z"))).toBe(3_600_000);
  });
});

describe("getLogDate", () => {
  it("formats the KST date", () => {
    expect(getLogDate(afternoon)).toBe("2026-11-08");
  });

  it("uses the KST date when UTC is still the previous day", () => {
    expect(getLogDate(justAfterMidnight)).toBe("2026-11-09");
  });
});

describe("getKstHour", () => {
  it("returns the KST hour", () => {
    expect(getKstHour(afternoon)).toBe(14);
    expect(getKstHour(justAfterMidnight)).toBe(0);
  });
});

describe("getRetainedDates", () => {
  it("returns today and yesterday in KST", () => {
    expect(getRetainedDates(justAfterMidnight)).toEqual({
      today: "2026-11-09",
      yesterday: "2026-11-08",
    });
  });

  it("crosses month boundaries", () => {
    expect(getRetainedDates(new Date("2026-11-30T16:00:00.000Z"))).toEqual({
      today: "2026-12-01",
      yesterday: "2026-11-30",
    });
  });
});

describe("isQuietHour", () => {
  it("handles a window that wraps past midnight", () => {
    expect(isQuietHour(23, 22, 7)).toBe(true);
    expect(isQuietHour(3, 22, 7)).toBe(true);
    expect(isQuietHour(7, 22, 7)).toBe(false);
    expect(isQuietHour(12, 22, 7)).toBe(false);
  });

  it("handles a same-day window with an exclusive end", () => {
    expect(isQuietHour(1, 1, 8)).toBe(true);
    expect(isQuietHour(7, 1, 8)).toBe(true);
    expect(isQuietHour(8, 1, 8)).toBe(false);
    expect(isQuietHour(0, 1, 8)).toBe(false);
  });

  it("treats equal start and end as no quiet hours", () => {
    expect(isQuietHour(5, 5, 5)).toBe(false);
  });
});
