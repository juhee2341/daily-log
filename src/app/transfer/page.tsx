import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TransferRedeemForm } from "@/components/transfer/TransferRedeemForm";
import { normalizeTransferCode } from "@/lib/transfer-format";

export const metadata: Metadata = { title: "기기 옮기기", robots: { index: false } };

export default function TransferPage({ searchParams }: PageProps<"/transfer">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <nav>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">기기 옮기기</h1>
        <p className="text-sm text-muted-foreground">옛 기기에서 참여하던 세션을 이 기기로 가져와요. 방장 권한도 함께 옮겨져요.</p>
      </header>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
        <TransferForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function TransferForm({ searchParams }: { searchParams: PageProps<"/transfer">["searchParams"] }) {
  const { code } = await searchParams;
  const normalized = typeof code === "string" ? normalizeTransferCode(code) : null;
  return <TransferRedeemForm initialCode={normalized ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : ""} />;
}
