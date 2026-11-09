import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 짧게 기다리는 동안의 회전 표시. label은 스크린 리더에 읽힌다. */
export function Spinner({ label = "불러오는 중", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center justify-center", className)}>
      <Loader2Icon aria-hidden className="size-6 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
