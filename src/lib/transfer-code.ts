import "server-only";
import { createHash, randomInt } from "node:crypto";
import { TRANSFER_ALPHABET, TRANSFER_CODE_LENGTH } from "@/lib/transfer-format";

export function generateTransferCode(): string {
  return Array.from({ length: TRANSFER_CODE_LENGTH }, () => TRANSFER_ALPHABET[randomInt(TRANSFER_ALPHABET.length)]).join("");
}

/** DB에는 원본 대신 해시만 저장한다. */
export function hashTransferCode(code: string): string {
  return createHash("sha256").update(`transfer:${code}`).digest("hex");
}
