import { generateInviteToken, hashToken, isWellFormedToken } from "./invite-token";

describe("invite tokens", () => {
  it("generates unique, well-formed 32-char URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInviteToken));
    expect(tokens.size).toBe(50);
    tokens.forEach((t) => expect(isWellFormedToken(t)).toBe(true));
  });

  it("hashes deterministically to hex sha256", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(31) + "/")).toBe(false);
    expect(isWellFormedToken("a".repeat(33))).toBe(false);
  });
});
