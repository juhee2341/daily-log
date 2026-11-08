"use client";

import { useEffect, useRef, useState } from "react";
import { formatKst } from "@/lib/slot";
import { PHOTO_MS, type VlogItem } from "@/lib/vlog";

const LONG_PRESS_MS = 250;

/**
 * V-1~V-3: 스토리처럼 이어서 재생한다.
 * 오른쪽 탭 = 다음, 왼쪽 탭 = 이전, 길게 누르기 = 일시정지. 처음 탭에서 소리를 켠다.
 */
export function VlogPlayer({ items }: { items: VlogItem[] }) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  // 사진을 일시정지했다가 이어 볼 때 남은 시간을 기억한다
  const photoElapsed = useRef(0);

  const finished = index >= items.length;
  const item = finished ? null : items[index];
  const playing = started && !held && !finished;

  function go(next: number) {
    photoElapsed.current = 0;
    setProgress(0);
    setIndex(Math.max(0, Math.min(items.length, next)));
  }

  // 사진: 2초 타이머 (일시정지 중에는 멈춘다)
  useEffect(() => {
    if (!playing || item?.type !== "photo") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      photoElapsed.current += now - last;
      last = now;
      if (photoElapsed.current >= PHOTO_MS) {
        photoElapsed.current = 0;
        setProgress(0);
        setIndex((i) => i + 1);
        return;
      }
      setProgress(photoElapsed.current / PHOTO_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, item]);

  // 영상: 재생·일시정지를 상태에 맞춘다. 소리 재생이 막히면 음소거로 다시 시도한다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || item?.type !== "video") return;
    if (!playing) return void video.pause();
    video.muted = muted;
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => {});
    });
  }, [playing, item, muted]);

  // 다음 항목 미리 받기
  const next = items[index + 1];
  useEffect(() => {
    if (!next) return;
    if (next.type === "photo") {
      const img = new Image();
      img.src = next.url;
    } else {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = next.url;
      document.head.appendChild(link);
      return () => link.remove();
    }
  }, [next]);

  function onPointerDown() {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setHeld(true);
    }, LONG_PRESS_MS);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (longPressed.current) return setHeld(false);
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width * 0.3 ? index - 1 : index + 1);
  }

  return (
    <div className="relative mx-auto aspect-[9/16] max-h-[72dvh] w-full overflow-hidden rounded-2xl bg-black text-white select-none">
      {item?.type === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 URL
        <img src={item.url} alt={`${item.nickname}의 사진`} className="size-full object-cover" draggable={false} />
      )}
      {item?.type === "video" && (
        <video
          key={item.id}
          ref={videoRef}
          src={item.url}
          className="size-full object-cover"
          playsInline
          preload="auto"
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || item.durationMs / 1000))}
          onEnded={() => go(index + 1)}
          aria-label={`${item.nickname}의 영상`}
        />
      )}

      {/* 진행 막대 + 정보 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pt-3 pb-8">
        <div className="flex gap-1" aria-hidden>
          {items.map((it, i) => (
            <div key={it.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        {item && (
          <p className="mt-2 text-sm">
            <strong className="font-bold">{formatKst(item.slotStart, "HH:00")}</strong>
            <span className="ml-2 font-medium">{item.nickname}</span>
          </p>
        )}
      </div>
      {item?.caption && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-4 text-sm break-words whitespace-pre-wrap">
          {item.caption}
        </p>
      )}

      {/* 탭·길게 누르기 영역 */}
      {started && !finished && (
        <div
          className="absolute inset-0"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setHeld(false)}
          onContextMenu={(e) => e.preventDefault()}
          role="group"
          aria-label="왼쪽을 누르면 이전, 오른쪽을 누르면 다음, 길게 누르면 일시정지"
        />
      )}
      {held && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl" aria-hidden>
          ❚❚
        </span>
      )}
      {started && muted && !finished && (
        <button
          type="button"
          onClick={() => setMuted(false)}
          className="absolute right-3 bottom-3 z-10 rounded-full bg-black/60 px-3 py-1.5 text-xs"
        >
          🔇 소리 켜기
        </button>
      )}

      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-lg font-semibold"
        >
          <span aria-hidden className="text-5xl">
            ▶
          </span>
          탭해서 재생 · {items.length}개
        </button>
      )}
      {finished && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <p className="font-semibold">끝까지 봤어요</p>
          <button type="button" onClick={() => go(0)} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black">
            다시 보기
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {item ? `${index + 1}번째, ${item.nickname}` : "재생이 끝났어요"}
      </p>
    </div>
  );
}
