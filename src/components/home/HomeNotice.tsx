const NOTICES = {
  destroyed: "방장이 세션을 폭파했어요. 모든 기록이 삭제됐어요.",
  kicked: "방장이 세션에서 내보냈어요.",
} as const;

export async function HomeNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { notice } = await searchParams;
  const message = typeof notice === "string" && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg bg-muted p-3 text-sm">
      {message}
    </p>
  );
}
