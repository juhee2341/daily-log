"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { issueCaptureTicket, publishPost, type CaptureTicket } from "@/app/actions/post";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { CAPTION_MAX, RECORDER_MIME_CANDIDATES, VIDEO_MAX_MS, VIDEO_MIN_MS, baseMime, type MediaMime } from "@/lib/media";
import { MEDIA_BUCKET } from "@/lib/storage-bucket";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "photo" | "video";
type Facing = "user" | "environment";
type Camera = { status: "loading" } | { status: "ready"; silent: boolean } | { status: "error"; message: string };
type Shot = { mime: MediaMime; blob: Blob; thumb: Blob; url: string; durationMs?: number };

const PHOTO_MAX_SIDE = 1440;
const THUMB_MAX_SIDE = 480;

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "카메라 권한이 거부됐어요. 브라우저 설정에서 카메라(영상은 마이크도)를 허용한 뒤 다시 열어주세요.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "사용할 수 있는 카메라를 찾지 못했어요.";
  if (name === "NotReadableError") return "다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해주세요.";
  return "카메라를 열지 못했어요. 다시 시도해주세요.";
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORDER_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** 현재 비디오 프레임을 JPEG로 뜬다 (긴 변 maxSide). */
function grabFrame(video: HTMLVideoElement, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
}

export function CaptureCamera({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ticketRef = useRef<Promise<ActionResult<CaptureTicket>> | null>(null);

  const [mode, setMode] = useState<Mode>("photo");
  const [facing, setFacing] = useState<Facing>("environment");
  const [camera, setCamera] = useState<Camera>({ status: "loading" });
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [shot, setShot] = useState<Shot | null>(null);
  const [caption, setCaption] = useState("");
  const captionTooLong = caption.trim().length > CAPTION_MAX;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 카메라 스트림(외부 시스템) 연결. 미리보기 중에는 끈다.
  useEffect(() => {
    if (shot) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setCamera({ status: "error", message: "이 브라우저에서는 카메라를 쓸 수 없어요. HTTPS 주소인지, 기본 브라우저인지 확인해주세요." }));
      return;
    }
    let cancelled = false;
    const video = { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } };

    // 영상 모드는 마이크도 요청하되, 마이크만 거부·없음이면 소리 없이라도 찍을 수 있게 한다
    const open = async (): Promise<{ stream: MediaStream; silent: boolean }> => {
      if (mode !== "video") return { stream: await navigator.mediaDevices.getUserMedia({ video }), silent: false };
      try {
        return { stream: await navigator.mediaDevices.getUserMedia({ video, audio: true }), silent: false };
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (name !== "NotAllowedError" && name !== "NotFoundError") throw e;
        return { stream: await navigator.mediaDevices.getUserMedia({ video }), silent: true };
      }
    };

    open()
      .then(async ({ stream, silent }) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const el = videoRef.current!;
        el.srcObject = stream;
        await el.play().catch(() => {});
        setCamera({ status: "ready", silent });
      })
      .catch((e: unknown) => !cancelled && setCamera({ status: "error", message: cameraErrorMessage(e) }));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode, facing, shot]);

  // Cache Components는 떠난 화면을 <Activity>로 숨겨 state를 보존한다.
  // 촬영 화면은 매번 새로 시작해야 하므로(지난 사진·이미 쓴 촬영 티켓이 남지 않게) 숨겨질 때 초기화한다.
  useLayoutEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      ticketRef.current = null;
      setRecordingSince(null);
      setElapsed(0);
      setShot(null);
      setCaption("");
      setUploading(false);
      setError(null);
      setCamera({ status: "loading" });
    };
  }, []);

  // 미리보기 blob URL 정리
  useEffect(() => {
    if (!shot) return;
    return () => URL.revokeObjectURL(shot.url);
  }, [shot]);

  // 녹화 경과 시간 (10초에 자동 정지)
  useEffect(() => {
    if (recordingSince === null) return;
    const id = window.setInterval(() => {
      const ms = performance.now() - recordingSince;
      setElapsed(ms);
      if (ms >= VIDEO_MAX_MS && recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 100);
    return () => window.clearInterval(id);
  }, [recordingSince]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setCamera({ status: "loading" });
    setMode(next);
  }

  function flip() {
    setCamera({ status: "loading" });
    setFacing((f) => (f === "user" ? "environment" : "user"));
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    // 셔터 시점에 슬롯을 확정한다 (P-4)
    ticketRef.current = issueCaptureTicket({ sessionId, mimeType: "image/jpeg" });
    const [blob, thumb] = await Promise.all([grabFrame(video, PHOTO_MAX_SIDE, 0.85), grabFrame(video, THUMB_MAX_SIDE, 0.7)]);
    setShot({ mime: "image/jpeg", blob, thumb, url: URL.createObjectURL(blob) });
  }

  async function startRecording() {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || camera.status !== "ready") {
      setError("카메라를 준비하는 중이에요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const recorderMime = pickRecorderMime();
    const mime = recorderMime && baseMime(recorderMime);
    if (!recorderMime || !mime) {
      setError("이 브라우저는 영상 촬영을 지원하지 않아요. 사진으로 올려주세요.");
      return;
    }
    setError(null);
    ticketRef.current = issueCaptureTicket({ sessionId, mimeType: mime });
    const thumb = await grabFrame(video, THUMB_MAX_SIDE, 0.7);

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: recorderMime, videoBitsPerSecond: 2_500_000 });
    const startedAt = performance.now();
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const durationMs = Math.round(performance.now() - startedAt);
      setRecordingSince(null);
      const blob = new Blob(chunks, { type: mime });
      setShot({ mime, blob, thumb, url: URL.createObjectURL(blob), durationMs });
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setElapsed(0);
    setRecordingSince(startedAt);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function retake() {
    setShot(null);
    setError(null);
    setCamera({ status: "loading" });
    ticketRef.current = null;
  }

  async function upload() {
    if (!shot || !ticketRef.current) return;
    setUploading(true);
    setError(null);
    try {
      const ticket = await ticketRef.current;
      if (!ticket.success) {
        setError(ticket.error);
        return;
      }
      const storage = createClient().storage.from(MEDIA_BUCKET);
      const [media, thumb] = await Promise.all([
        storage.uploadToSignedUrl(ticket.data.media.path, ticket.data.media.token, shot.blob, { contentType: shot.mime }),
        storage.uploadToSignedUrl(ticket.data.thumb.path, ticket.data.thumb.token, shot.thumb, { contentType: "image/jpeg" }),
      ]);
      if (media.error || thumb.error) {
        setError("업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.");
        return;
      }
      const result = await publishPost({
        ticketId: ticket.data.ticketId,
        mimeType: shot.mime,
        caption: caption.trim() || undefined,
        durationMs: shot.durationMs,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace(`/s/${sessionId}/p/${result.data.postId}`);
    } catch {
      setError("업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  const recording = recordingSince !== null;
  const tooShort = shot?.durationMs !== undefined && shot.durationMs < VIDEO_MIN_MS;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <Link href={`/s/${sessionId}`} className="rounded-full px-2 py-1 text-sm text-white/80 hover:text-white">
          ✕ 닫기
        </Link>
        {recording && (
          <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm tabular-nums">
            <span className="size-2 rounded-full bg-red-500" aria-hidden />
            {(elapsed / 1000).toFixed(1)}초 / 10초
          </span>
        )}
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center overflow-hidden">
        {shot ? (
          shot.mime === "image/jpeg" ? (
            // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기
            <img src={shot.url} alt="찍은 사진 미리보기" className="max-h-full w-full object-contain" />
          ) : (
            <video src={shot.url} className="max-h-full w-full object-contain" autoPlay loop playsInline controls aria-label="찍은 영상 미리보기" />
          )
        ) : (
          <>
            <video
              ref={videoRef}
              className={cn("size-full object-cover", facing === "user" && "-scale-x-100")}
              autoPlay
              muted
              playsInline
              aria-label="카메라 화면"
            />
            {camera.status === "loading" && <p className="absolute text-sm text-white/70">카메라 여는 중...</p>}
            {camera.status === "error" && (
              <p role="alert" className="absolute mx-6 rounded-xl bg-white/10 p-4 text-center text-sm leading-relaxed">
                {camera.message}
              </p>
            )}
          </>
        )}
        {recording && (
          <div className="absolute inset-x-0 top-0 h-1 bg-white/20" aria-hidden>
            <div className="h-full bg-red-500 transition-[width]" style={{ width: `${Math.min(100, (elapsed / VIDEO_MAX_MS) * 100)}%` }} />
          </div>
        )}
      </div>

      <footer className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/20 p-3 text-sm">
            {error}
          </p>
        )}

        {shot ? (
          <>
            {tooShort && (
              <p role="alert" className="text-center text-sm text-amber-300">
                영상은 2초 이상이어야 해요. 다시 찍어주세요.
              </p>
            )}
            <label className="sr-only" htmlFor="caption">
              코멘트
            </label>
            <div className="relative">
              <textarea
                id="caption"
                // 비제어 입력: React가 값을 다시 써넣으면 iOS 한글 조합(천지인 등)이 깨진다
                defaultValue={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="코멘트 (선택)"
                rows={2}
                aria-invalid={captionTooLong}
                className="w-full resize-none rounded-xl bg-white/10 p-3 pr-14 text-base placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              />
              <span
                className={cn("absolute right-3 bottom-3 text-xs tabular-nums", captionTooLong ? "text-red-300" : "text-white/50")}
                aria-hidden
              >
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="h-12 flex-1" onClick={retake} disabled={uploading}>
                다시 찍기
              </Button>
              <Button size="lg" className="h-12 flex-1 bg-white text-black hover:bg-white/90" onClick={upload} disabled={uploading || tooShort || captionTooLong}>
                {uploading ? "올리는 중..." : "올리기"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center gap-1 text-sm" role="tablist" aria-label="촬영 모드">
              {(["photo", "video"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  disabled={recording}
                  onClick={() => switchMode(m)}
                  className={cn("rounded-full px-4 py-1.5", mode === m ? "bg-white text-black" : "text-white/70")}
                >
                  {m === "photo" ? "사진" : "영상"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 items-center">
              <span />
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={camera.status !== "ready"}
                  onClick={mode === "photo" ? takePhoto : recording ? stopRecording : startRecording}
                  aria-label={mode === "photo" ? "사진 찍기" : recording ? "녹화 멈추기" : "녹화 시작"}
                  className="flex size-18 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
                >
                  <span
                    className={cn(
                      "transition-all",
                      mode === "photo" && "size-14 rounded-full bg-white",
                      mode === "video" && !recording && "size-14 rounded-full bg-red-500",
                      recording && "size-7 rounded-md bg-red-500",
                    )}
                  />
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={flip}
                  disabled={recording || camera.status === "loading"}
                  aria-label="카메라 전환"
                  className="rounded-full bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
                >
                  ⟲ 전환
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-white/60">
              {mode === "photo"
                ? "지금 이 순간을 찍어주세요"
                : camera.status === "ready" && camera.silent
                  ? "마이크 권한이 없어 소리 없이 녹화돼요"
                  : "2초 이상, 10초가 되면 자동으로 멈춰요"}
            </p>
          </>
        )}
      </footer>
    </div>
  );
}
