// 촬영·업로드 규칙 (P-1~P-5). 브라우저와 서버가 함께 쓴다.

export const VIDEO_MIN_MS = 2_000;
export const VIDEO_MAX_MS = 10_000;
export const CAPTION_MAX = 100;
export const TICKET_TTL_MS = 5 * 60 * 1000;
export const CANCEL_WINDOW_MS = 3 * 60 * 1000;
export const MAX_TICKETS_PER_SLOT = 10;

export const MEDIA_LIMITS = {
  "image/jpeg": { kind: "photo", ext: "jpg", maxBytes: 5 * 1024 * 1024 },
  "video/mp4": { kind: "video", ext: "mp4", maxBytes: 20 * 1024 * 1024 },
  "video/webm": { kind: "video", ext: "webm", maxBytes: 20 * 1024 * 1024 },
} as const;
export const THUMB_MAX_BYTES = 1024 * 1024;

export type MediaMime = keyof typeof MEDIA_LIMITS;
export const MEDIA_MIMES = Object.keys(MEDIA_LIMITS) as MediaMime[];

/** MediaRecorder가 돌려준 `video/mp4;codecs=...` 같은 값을 저장용 기본 타입으로 줄인다. */
export function baseMime(mime: string): MediaMime | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base in MEDIA_LIMITS ? (base as MediaMime) : null;
}

/** 파일 앞부분(매직 바이트)으로 실제 형식을 판별한다. 클라이언트가 보낸 content-type은 믿지 않는다. */
export function sniffMime(bytes: Uint8Array): MediaMime | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return "video/webm";
  // ISO BMFF: [size(4)] 'ftyp'
  if (bytes.length >= 8 && at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) return "video/mp4";
  return null;
}

/** media/{sessionId}/{memberId}/{postId}.{ext} 와 썸네일 경로. */
export function mediaPaths(sessionId: string, memberId: string, postId: string, mime: MediaMime) {
  const dir = `${sessionId}/${memberId}`;
  return { media: `${dir}/${postId}.${MEDIA_LIMITS[mime].ext}`, thumb: `${dir}/${postId}_thumb.jpg` };
}

/** 영상 녹화에 쓸 MediaRecorder 형식. mp4(H.264)를 우선한다 — iOS Safari와 호환. */
export const RECORDER_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
