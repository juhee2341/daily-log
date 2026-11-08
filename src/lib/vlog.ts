// 브이로그 재생·내보내기 공용 규칙 (V-1~V-4). 브라우저와 서버가 함께 쓴다.

export const PHOTO_MS = 2_000;
export const TITLE_MS = 1_500;
export const EXPORT_WIDTH = 720;
export const EXPORT_HEIGHT = 1280;
export const EXPORT_FPS = 30;

export type VlogItem = {
  id: string;
  type: "photo" | "video";
  url: string;
  durationMs: number;
  memberId: string;
  nickname: string;
  caption: string | null;
  slotStart: string;
};

/** 항목 하나가 화면에 머무는 시간. 사진 2초, 영상은 자기 길이. */
export function itemDuration(item: Pick<VlogItem, "type" | "durationMs">): number {
  return item.type === "photo" ? PHOTO_MS : item.durationMs;
}

export function totalDuration(items: Pick<VlogItem, "type" | "durationMs">[]): number {
  return items.reduce((sum, item) => sum + itemDuration(item), 0);
}

/** object-fit: cover 처럼 원본을 대상 영역에 꽉 차게 자르는 원본 기준 영역. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = dstW / scale;
  const h = dstH / scale;
  return { sx: (srcW - w) / 2, sy: (srcH - h) / 2, sw: w, sh: h };
}

/** 폭에 맞춰 글자 단위로 줄바꿈 (한국어는 단어 경계가 없어도 자연스럽게). 최대 줄 수를 넘으면 말줄임. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const ch of paragraph) {
      if (measure(line + ch) > maxWidth && line) {
        lines.push(line);
        line = ch.trimStart();
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** 저장 파일 이름: daily-log-20261108-전체.mp4 */
export function vlogFileName(logDate: string, label: string, ext: string): string {
  const safe = label.replace(/[\\/:*?"<>|\s]+/g, "_");
  return `daily-log-${logDate.replaceAll("-", "")}-${safe}.${ext}`;
}
