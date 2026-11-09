"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { MEDIA_LIMITS } from "@/lib/media";
import { totalDuration, vlogFileName, type VlogItem } from "@/lib/vlog";
import { checkExportSupport, exportVlog, type ExportSupport } from "@/lib/vlog-export";

type Result = { url: string; file: File };
type Phase = { status: "idle" } | { status: "running"; progress: number } | { status: "done"; result: Result } | { status: "error"; message: string };

const subscribe = () => () => {};
let cachedSupport: ExportSupport | null = null;
const readSupport = () => (cachedSupport ??= checkExportSupport());

/** V-4: 지금 보고 있는 모드(전체/멤버)를 9:16 영상으로 저장·공유한다. */
export function VlogExporter({
  items,
  title,
  subtitle,
  logDate,
  label,
}: {
  items: VlogItem[];
  title: string;
  subtitle: string;
  logDate: string;
  label: string;
}) {
  const support = useSyncExternalStore(subscribe, readSupport, () => null);
  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const seconds = Math.round(totalDuration(items) / 1000) + 2;

  // 결과 blob URL 정리, 화면을 떠나면 진행 중인 내보내기 취소
  const resultUrl = phase.status === "done" ? phase.result.url : null;
  useEffect(() => {
    if (!resultUrl) return;
    return () => URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    if (!support?.ok) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ status: "running", progress: 0 });
    try {
      const blob = await exportVlog({
        items,
        title,
        subtitle,
        support,
        signal: controller.signal,
        onProgress: (progress) => setPhase({ status: "running", progress }),
      });
      const file = new File([blob], vlogFileName(logDate, label, MEDIA_LIMITS[support.mime].ext), { type: support.mime });
      setPhase({ status: "done", result: { url: URL.createObjectURL(blob), file } });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return setPhase({ status: "idle" });
      setPhase({ status: "error", message: error instanceof Error ? error.message : "영상을 만들지 못했어요." });
    }
  }

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title });
    } catch {
      // 공유 시트를 닫은 경우
    }
  }

  if (support && !support.ok) return <p className="text-center text-xs text-muted-foreground">{support.reason}</p>;

  if (phase.status === "running") {
    return (
      <div className="flex flex-col gap-2" role="status" aria-live="polite">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-highlight transition-[width]" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          영상 만드는 중 {Math.round(phase.progress * 100)}% · 화면을 켜둔 채로 기다려주세요
        </p>
        <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
          취소
        </Button>
      </div>
    );
  }

  if (phase.status === "done") {
    const { url, file } = phase.result;
    const canShare = typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
    return (
      <div className="flex flex-col gap-2" role="status">
        <p className="text-center text-sm">영상이 준비됐어요 ({(file.size / 1024 / 1024).toFixed(1)}MB)</p>
        <div className="flex gap-2">
          {canShare && (
            <Button className="flex-1" onClick={() => share(file)}>
              공유하기
            </Button>
          )}
          <Button asChild variant={canShare ? "outline" : "default"} className="flex-1">
            <a href={url} download={file.name}>
              저장하기
            </a>
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPhase({ status: "idle" })}>
          닫기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" onClick={start} disabled={!support || !items.length}>
        영상으로 저장 (약 {seconds}초 걸려요)
      </Button>
      {phase.status === "error" && (
        <p role="alert" className="text-center text-sm text-destructive">
          {phase.message}
        </p>
      )}
    </div>
  );
}
