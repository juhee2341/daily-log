import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PostNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">없는 포스트예요</h1>
      <p className="text-sm text-muted-foreground">올린 사람이 취소했거나, 보관 기간(오늘·어제)이 지나 사라졌어요.</p>
      <Button asChild variant="outline">
        <Link href="/">홈으로</Link>
      </Button>
    </main>
  );
}
