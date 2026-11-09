import { cn } from "@/lib/utils";

// logo-wordmark.svg viewBox 비율 (455.55 × 110.85)
const RATIO = 455.55 / 110.85;

/** 로고타입. 글자는 윤곽선이라 폰트가 필요 없다. 높이는 24~32px 권장 (BRAND.md). */
export function Logo({ height = 28, onDark = false, className }: { height?: number; onDark?: boolean; className?: string }) {
  return (
    // 정적 SVG라 next/image 최적화가 필요 없다. width/height로 자리를 잡아 레이아웃 밀림을 막는다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={onDark ? "/brand/logo-wordmark-on-dark.svg" : "/brand/logo-wordmark.svg"}
      alt="daily-log"
      width={Math.round(height * RATIO)}
      height={height}
      className={cn("block h-auto max-w-full select-none", className)}
      draggable={false}
    />
  );
}
