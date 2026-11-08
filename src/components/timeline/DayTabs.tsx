import Link from "next/link";
import { formatKst } from "@/lib/slot";
import { cn } from "@/lib/utils";

type Props = {
  basePath: string;
  day: "today" | "yesterday";
  logDate: string;
  /** 오른쪽에 붙는 다른 화면 링크 (예: 하루 지도, 브이로그) */
  links?: { href: string; label: string }[];
};

export function DayTabs({ basePath, day, logDate, links = [] }: Props) {
  const tabs = [
    { key: "today", label: "오늘", href: basePath },
    { key: "yesterday", label: "어제", href: `${basePath}?day=yesterday` },
  ] as const;
  return (
    <nav aria-label="날짜" className="flex items-center gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={day === tab.key ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            day === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
      <span className="ml-auto text-xs text-muted-foreground">{formatKst(`${logDate}T12:00:00+09:00`, "M월 d일")}</span>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap hover:bg-muted">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
