import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 화면 모양을 닮은 로딩 자리. 스크린 리더에는 "불러오는 중" 하나만 읽힌다. */
function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} />;
}

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col", className)}>
      <span className="sr-only">불러오는 중</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

function TabsBone() {
  return (
    <div className="flex items-center gap-2">
      <Bone className="h-9 w-16 rounded-full" />
      <Bone className="h-9 w-16 rounded-full" />
      <div className="flex-1" />
      <Bone className="h-8 w-20 rounded-full" />
    </div>
  );
}

/** /s/[id] 타임라인 */
export function TimelineSkeleton() {
  return (
    <Loading className="gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Bone className="h-7 w-40" />
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-8 w-20" />
      </div>
      <TabsBone />
      <Bone className="h-14 w-full rounded-xl" />
      {[0, 1].map((slot) => (
        <div key={slot} className="flex flex-col gap-2">
          <Bone className="h-4 w-14" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** /s/[id]/members */
export function MembersSkeleton() {
  return (
    <Loading className="gap-6">
      <Bone className="h-4 w-24" />
      <Bone className="h-7 w-16" />
      <div className="flex flex-col gap-3">
        <Bone className="h-4 w-16" />
        <Bone className="h-10 w-full rounded-lg" />
        <Bone className="h-10 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Bone className="h-4 w-20" />
        <div className="flex flex-col divide-y rounded-xl border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-12 items-center px-3 py-2">
              <Bone className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** /s/[id]/map */
export function DayMapSkeleton() {
  return (
    <Loading className="gap-5">
      <Bone className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Bone className="h-7 w-24" />
        <Bone className="h-4 w-28" />
      </div>
      <TabsBone />
      <div className="flex flex-col gap-3 rounded-xl border p-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-2">
            <Bone className="h-4 w-12 shrink-0" />
            <div className="grid flex-1 grid-cols-12 gap-1">
              {Array.from({ length: 12 }, (_, i) => (
                <Bone key={i} className="aspect-square rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** /s/[id]/p/[postId] */
export function PostSkeleton() {
  return (
    <Loading className="gap-4">
      <Bone className="h-4 w-20" />
      <Bone className="aspect-[3/4] w-full rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-48" />
        <Bone className="h-5 w-3/4" />
      </div>
      <div className="flex flex-col gap-3 border-t pt-4">
        <Bone className="h-4 w-14" />
        <Bone className="h-4 w-2/3" />
        <Bone className="h-4 w-1/2" />
        <Bone className="h-10 w-full rounded-lg" />
      </div>
    </Loading>
  );
}

/** /s/[id]/vlog */
export function VlogSkeleton() {
  return (
    <Loading className="gap-4">
      <Bone className="h-4 w-24" />
      <Bone className="h-7 w-24" />
      <TabsBone />
      <div className="flex gap-2">
        {["w-14", "w-16", "w-12"].map((w) => (
          <Bone key={w} className={cn("h-8 rounded-full", w)} />
        ))}
      </div>
      <Bone className="mx-auto aspect-[9/16] max-h-[72dvh] w-full rounded-2xl" />
      <Bone className="h-11 w-full rounded-lg" />
    </Loading>
  );
}

/** /join/[token] */
export function JoinSkeleton() {
  return (
    <Loading className="gap-6">
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-48" />
      </div>
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-12" />
        <Bone className="h-11 w-full rounded-lg" />
      </div>
      <Bone className="h-16 w-full rounded-lg" />
      <Bone className="h-11 w-full rounded-lg" />
    </Loading>
  );
}

/** 폼 하나짜리 영역 (설정 알림, 기기 옮기기) */
export function FormSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Loading className="gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Bone key={i} className="h-10 w-full rounded-lg" />
      ))}
      <Bone className="h-11 w-full rounded-lg" />
    </Loading>
  );
}

/** 홈 세션 카드 목록 */
export function SessionListSkeleton() {
  return (
    <Loading className="gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-4">
          <Bone className="h-5 w-36" />
          <Bone className="h-4 w-28" />
        </div>
      ))}
    </Loading>
  );
}
