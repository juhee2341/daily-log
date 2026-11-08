import { TZDate } from "@date-fns/tz";
import { addDays, addHours, format, startOfHour } from "date-fns";

export const TIME_ZONE = "Asia/Seoul";

const toKst = (date: Date) => new TZDate(date, TIME_ZONE);

/** 해당 시각이 속한 슬롯(KST 정시)의 시작 시각. */
export function getSlotStart(date: Date): Date {
  return new Date(startOfHour(toKst(date)).getTime());
}

/** 다음 슬롯까지 남은 밀리초. */
export function msUntilNextSlot(now: Date): number {
  return addHours(getSlotStart(now), 1).getTime() - now.getTime();
}

/** KST 날짜 (`yyyy-MM-dd`). 타임라인 탭과 보관 기준. */
export function getLogDate(date: Date): string {
  return format(toKst(date), "yyyy-MM-dd");
}

/** KST 시 (0~23). */
export function getKstHour(date: Date): number {
  return toKst(date).getHours();
}

/** 오늘과 어제 날짜. 이보다 이전 데이터는 보관 대상이 아니다 (D-1). */
export function getRetainedDates(now: Date): { today: string; yesterday: string } {
  return {
    today: getLogDate(now),
    yesterday: format(addDays(toKst(now), -1), "yyyy-MM-dd"),
  };
}

/** 방해금지 시간대인지. `start === end`면 방해금지 없음, `start > end`면 자정을 넘는 구간. */
export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** KST 기준 표시용 포맷 (예: `HH:mm`, `M월 d일`). */
export function formatKst(date: Date | string, pattern: string): string {
  return format(toKst(typeof date === "string" ? new Date(date) : date), pattern);
}
