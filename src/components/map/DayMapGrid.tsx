import Link from "next/link";
import type { DayMap } from "@/lib/data/day-map";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** M-1, M-2: 멤버 × 24시간 점 그리드. 채워진 점을 누르면 그 포스트로 간다. */
export function DayMapGrid({ sessionId, map }: { sessionId: string; map: DayMap }) {
  return (
    <div className="overflow-x-auto pb-2">
      {/* 24칸을 화면 폭에 맞춘다 (가로 스크롤 없이 하루 전체가 보이도록) */}
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-0 text-xs">
        <colgroup>
          <col className="w-[4.5rem]" />
          {HOURS.map((h) => (
            <col key={h} />
          ))}
        </colgroup>
        <caption className="sr-only">멤버별 시간대 기록. 채워진 점은 그 시간에 올린 포스트예요.</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-background pr-2 text-left font-normal text-muted-foreground">
              <span className="sr-only">멤버</span>
            </th>
            {HOURS.map((h) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  "pb-1 text-center text-[10px] font-normal tabular-nums text-muted-foreground",
                  h === map.currentHour && "font-bold text-foreground",
                )}
              >
                {h % 6 === 0 ? h : <span className="sr-only">{h}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {map.rows.map((row) => (
            <tr key={row.memberId}>
              <th
                scope="row"
                className="sticky left-0 z-10 truncate bg-background py-1 pr-2 text-left text-sm font-medium"
              >
                {row.nickname}
                {row.isMe && <span className="ml-1 text-xs font-normal text-muted-foreground">(나)</span>}
              </th>
              {row.cells.map((postId, h) => (
                <td key={h} className={cn("h-9 px-px text-center", h === map.currentHour && "bg-highlight/10")}>
                  {postId ? (
                    <Link
                      href={`/s/${sessionId}/p/${postId}`}
                      aria-label={`${row.nickname} ${h}시 포스트 보기`}
                      className="mx-auto block aspect-square w-full max-w-4 rounded-full bg-highlight transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "mx-auto block size-1.5 rounded-full bg-muted-foreground/25",
                        map.currentHour !== null && h > map.currentHour && "bg-transparent",
                      )}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-background pt-2 pr-2 text-left text-xs font-normal text-muted-foreground">
              합계
            </th>
            {map.totals.map((n, h) => (
              <td key={h} className="pt-2 text-center text-[10px] tabular-nums text-muted-foreground">
                {n || ""}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
