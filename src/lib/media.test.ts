import { baseMime, mediaPaths, sniffMime } from "./media";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffMime", () => {
  it("detects JPEG", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("detects WebM (EBML header)", () => {
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01))).toBe("video/webm");
  });

  it("detects MP4 by the ftyp box", () => {
    expect(sniffMime(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d))).toBe("video/mp4");
  });

  it("rejects unknown or too-short content", () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBeNull(); // PNG
    expect(sniffMime(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffMime(bytes())).toBeNull();
  });
});

describe("baseMime", () => {
  it("strips codec parameters", () => {
    expect(baseMime("video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe("video/mp4");
    expect(baseMime("Video/WebM; codecs=vp9")).toBe("video/webm");
    expect(baseMime("image/jpeg")).toBe("image/jpeg");
  });

  it("returns null for unsupported types", () => {
    expect(baseMime("video/quicktime")).toBeNull();
    expect(baseMime("image/png")).toBeNull();
  });
});

describe("mediaPaths", () => {
  it("builds session/member scoped paths", () => {
    expect(mediaPaths("s", "m", "p", "video/mp4")).toEqual({ media: "s/m/p.mp4", thumb: "s/m/p_thumb.jpg" });
    expect(mediaPaths("s", "m", "p", "image/jpeg").media).toBe("s/m/p.jpg");
  });
});
