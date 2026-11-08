import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">찾을 수 없어요</h1>
      <p className="text-sm text-muted-foreground">세션이 폭파됐거나, 참여 중인 세션이 아니에요.</p>
      <Button asChild>
        <Link href="/">홈으로</Link>
      </Button>
    </main>
  );
}
