import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InstallGuide } from "@/components/settings/InstallGuide";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { TransferIssuer } from "@/components/transfer/TransferIssuer";
import { getCurrentUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <nav>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
      </nav>
      <h1 className="text-xl font-bold">설정</h1>

      <section aria-labelledby="notify-heading" className="flex flex-col gap-3">
        <h2 id="notify-heading" className="text-sm font-semibold text-muted-foreground">
          알림
        </h2>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden />}>
          <NotificationSection />
        </Suspense>
      </section>

      <section aria-labelledby="transfer-heading" className="flex flex-col gap-3">
        <h2 id="transfer-heading" className="text-sm font-semibold text-muted-foreground">
          기기 옮기기
        </h2>
        <TransferIssuer />
      </section>

      <section aria-labelledby="install-heading" className="flex flex-col gap-3">
        <h2 id="install-heading" className="text-sm font-semibold text-muted-foreground">
          홈 화면에 추가
        </h2>
        <InstallGuide />
      </section>
    </main>
  );
}

/** 이 기기(익명 사용자)의 저장된 방해금지 시간을 초기값으로 쓴다. */
async function NotificationSection() {
  const userId = await getCurrentUserId();
  const { data } = userId
    ? await createAdminClient()
        .from("push_subscriptions")
        .select("quiet_start, quiet_end")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  return <NotificationSettings initialQuiet={{ start: data?.quiet_start ?? 1, end: data?.quiet_end ?? 8 }} />;
}
