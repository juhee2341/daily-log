import { TRANSFER_ALPHABET, formatTransferCode, normalizeTransferCode } from "./transfer-format";
import { generateTransferCode, hashTransferCode } from "./transfer-code";

describe("transfer codes", () => {
  it("generates 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateTransferCode();
      expect(code).toHaveLength(8);
      expect([...code].every((c) => TRANSFER_ALPHABET.includes(c))).toBe(true);
    }
  });

  it("never uses look-alike characters", () => {
    expect(TRANSFER_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalizes case, hyphens and spaces", () => {
    expect(normalizeTransferCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeTransferCode("ab cd 23 45")).toBe("ABCD2345");
  });

  it("rejects wrong lengths and look-alike characters", () => {
    expect(normalizeTransferCode("ABCD234")).toBeNull();
    expect(normalizeTransferCode("ABCD-234O")).toBeNull();
    expect(normalizeTransferCode("ABCD-2341")).toBeNull();
  });

  it("formats with a hyphen and hashes deterministically", () => {
    expect(formatTransferCode("ABCD2345")).toBe("ABCD-2345");
    expect(hashTransferCode("ABCD2345")).toBe(hashTransferCode("ABCD2345"));
    expect(hashTransferCode("ABCD2345")).not.toBe(hashTransferCode("ABCD2346"));
  });
});
