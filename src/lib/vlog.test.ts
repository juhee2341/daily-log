import { coverCrop, itemDuration, totalDuration, vlogFileName, wrapText } from "./vlog";

describe("durations", () => {
  it("shows photos for 2s and videos for their own length", () => {
    expect(itemDuration({ type: "photo", durationMs: 0 })).toBe(2000);
    expect(itemDuration({ type: "video", durationMs: 4365 })).toBe(4365);
    expect(totalDuration([{ type: "photo", durationMs: 0 }, { type: "video", durationMs: 3000 }])).toBe(5000);
  });
});

describe("coverCrop", () => {
  it("crops the sides of a landscape source into a portrait frame", () => {
    expect(coverCrop(1920, 1080, 720, 1280)).toEqual({ sx: 656.25, sy: 0, sw: 607.5, sh: 1080 });
  });

  it("crops top and bottom of a tall source", () => {
    const r = coverCrop(1080, 2400, 720, 1280);
    expect(r.sx).toBe(0);
    expect(r.sw).toBe(1080);
    expect(r.sh).toBeCloseTo(1920);
    expect(r.sy).toBeCloseTo(240);
  });

  it("is the identity when ratios match", () => {
    expect(coverCrop(720, 1280, 720, 1280)).toEqual({ sx: 0, sy: 0, sw: 720, sh: 1280 });
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length * 10; // 글자당 10px

  it("wraps by character to fit the width", () => {
    expect(wrapText("가나다라마바사", 30, measure)).toEqual(["가나다", "라마바", "사"]);
  });

  it("respects explicit newlines", () => {
    expect(wrapText("가나\n다", 100, measure)).toEqual(["가나", "다"]);
  });

  it("drops leading spaces at wrapped line starts", () => {
    expect(wrapText("ab cd", 20, measure)).toEqual(["ab", "cd"]);
  });

  it("ellipsizes beyond the max line count", () => {
    expect(wrapText("가나다라마바사아자차", 30, measure, 2)).toEqual(["가나다", "라마…"]);
  });
});

describe("vlogFileName", () => {
  it("builds a safe file name", () => {
    expect(vlogFileName("2026-11-08", "전체", "mp4")).toBe("daily-log-20261108-전체.mp4");
    expect(vlogFileName("2026-11-08", "민 지/", "webm")).toBe("daily-log-20261108-민_지_.webm");
  });
});
