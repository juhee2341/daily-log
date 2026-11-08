import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 초대 링크용 토큰 (URL-safe, 192bit). 원본은 링크에만 존재하고 DB에는 해시만 저장한다. */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 형식이 맞지 않는 토큰은 DB 조회 전에 거른다. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}
