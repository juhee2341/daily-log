// ID-4 기기 옮기기 코드 표기 (브라우저·서버 공용).
// 헷갈리는 글자(0/O, 1/I/L)를 뺀 31자 × 8자리 ≈ 8.5×10^11 가지, 10분 유효.

export const TRANSFER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TRANSFER_CODE_LENGTH = 8;
export const TRANSFER_TTL_MS = 10 * 60 * 1000;

/** 사용자가 입력한 값을 정규화한다 (대소문자·하이픈·공백 무시). 형식이 틀리면 null. */
export function normalizeTransferCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== TRANSFER_CODE_LENGTH) return null;
  return [...code].every((ch) => TRANSFER_ALPHABET.includes(ch)) ? code : null;
}

/** ABCD2345 → ABCD-2345 */
export function formatTransferCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
