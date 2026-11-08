import type { Metadata } from "next";
import Link from "next/link";
import { CreateSessionForm } from "@/components/session/CreateSessionForm";

export const metadata: Metadata = { title: "새 세션" };

export default function NewSessionPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <nav>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">새 세션 만들기</h1>
        <p className="text-sm text-muted-foreground">
          만든 사람이 방장이 돼요. 방장이 나가면 세션은 사라져요.
        </p>
      </header>
      <CreateSessionForm />
    </main>
  );
}
