// V-4: 브라우저 안에서 브이로그를 영상 파일로 만든다 (서버 비용 없음).
// canvas에 한 장면씩 그리면서 canvas.captureStream + 영상 소리를 MediaRecorder로 녹화한다.
// 실제 재생 시간만큼 걸리며, 탭이 백그라운드로 가면 브라우저가 그리기를 멈추므로 화면을 켜둬야 한다.

import { RECORDER_MIME_CANDIDATES, baseMime, type MediaMime } from "@/lib/media";
import { formatKst } from "@/lib/slot";
import {
  EXPORT_FPS,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  PHOTO_MS,
  TITLE_MS,
  coverCrop,
  itemDuration,
  totalDuration,
  wrapText,
  type VlogItem,
} from "@/lib/vlog";

const FONT = `"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`;
// 영상이 끝 이벤트를 놓쳐도 멈추지 않도록 여유를 둔 상한
const VIDEO_SLACK_MS = 1_500;

export type ExportSupport = { ok: true; recorderMime: string; mime: MediaMime } | { ok: false; reason: string };

export function checkExportSupport(): ExportSupport {
  if (typeof MediaRecorder === "undefined") return { ok: false, reason: "이 브라우저는 영상 저장을 지원하지 않아요." };
  if (typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) {
    return { ok: false, reason: "이 브라우저는 영상 저장을 지원하지 않아요. 최신 Chrome이나 Safari를 써주세요." };
  }
  const recorderMime = RECORDER_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
  const mime = recorderMime && baseMime(recorderMime);
  if (!recorderMime || !mime || mime === "image/jpeg") return { ok: false, reason: "이 브라우저는 영상 저장을 지원하지 않아요." };
  return { ok: true, recorderMime, mime };
}

type Options = {
  items: VlogItem[];
  title: string;
  subtitle: string;
  support: Extract<ExportSupport, { ok: true }>;
  onProgress: (ratio: number) => void;
  signal: AbortSignal;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("영상을 불러오지 못했어요."));
    video.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, srcW: number, srcH: number) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  if (!srcW || !srcH) return;
  const { sx, sy, sw, sh } = coverCrop(srcW, srcH, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
}

function drawOverlay(ctx: CanvasRenderingContext2D, item: VlogItem, brand: string) {
  // 위·아래 그라데이션
  const top = ctx.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, "rgba(0,0,0,0.55)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, EXPORT_WIDTH, 220);

  ctx.fillStyle = "white";
  ctx.textBaseline = "top";
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(formatKst(item.slotStart, "HH:00"), 40, 48);
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(item.nickname, 40, 100);
  ctx.font = `500 22px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.textAlign = "right";
  ctx.fillText(brand, EXPORT_WIDTH - 40, 56);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  if (!item.caption) return;
  ctx.font = `500 34px ${FONT}`;
  const lines = wrapText(item.caption, EXPORT_WIDTH - 80, (s) => ctx.measureText(s).width, 3);
  const lineHeight = 48;
  const blockTop = EXPORT_HEIGHT - 80 - lines.length * lineHeight;
  const bottom = ctx.createLinearGradient(0, blockTop - 80, 0, EXPORT_HEIGHT);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, blockTop - 80, EXPORT_WIDTH, EXPORT_HEIGHT - blockTop + 80);
  ctx.fillStyle = "white";
  lines.forEach((line, i) => ctx.fillText(line, 40, blockTop + i * lineHeight));
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 56px ${FONT}`;
  const lines = wrapText(title, EXPORT_WIDTH - 120, (s) => ctx.measureText(s).width, 2);
  lines.forEach((line, i) => ctx.fillText(line, EXPORT_WIDTH / 2, EXPORT_HEIGHT / 2 - 40 + (i - (lines.length - 1) / 2) * 68));
  ctx.font = `500 30px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(subtitle, EXPORT_WIDTH / 2, EXPORT_HEIGHT / 2 + 60 + (lines.length - 1) * 34);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/** requestAnimationFrame마다 draw를 부르다가 done()이 참이 되면 끝낸다. */
function runFrames(draw: (elapsed: number) => boolean, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      if (signal.aborted) return reject(new DOMException("취소됨", "AbortError"));
      if (draw(performance.now() - start)) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function exportVlog({ items, title, subtitle, support, onProgress, signal }: Options): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawTitle(ctx, title, subtitle);

  const stream = canvas.captureStream(EXPORT_FPS);
  const hasVideo = items.some((i) => i.type === "video");
  const audio = hasVideo ? new AudioContext() : null;
  const audioOut = audio?.createMediaStreamDestination();
  audioOut?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  // 소리가 없는 구간(타이틀·사진)에도 무음 샘플을 계속 흘려보낸다.
  // 그러지 않으면 Chrome MediaRecorder가 첫 오디오 샘플 이전의 화면을 버려서 앞부분이 잘린다.
  const silence = audio?.createConstantSource();
  if (silence && audioOut) {
    silence.offset.value = 0;
    silence.connect(audioOut);
    silence.start();
  }

  const recorder = new MediaRecorder(stream, { mimeType: support.recorderMime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  const total = TITLE_MS + totalDuration(items);
  let done = 0;
  const report = (elapsed: number) => onProgress(Math.min(1, (done + elapsed) / total));

  try {
    await audio?.resume();
    recorder.start(1000);

    await runFrames((elapsed) => {
      drawTitle(ctx, title, subtitle);
      report(elapsed);
      return elapsed >= TITLE_MS;
    }, signal);
    done += TITLE_MS;

    for (const item of items) {
      if (item.type === "photo") {
        const img = await loadImage(item.url);
        await runFrames((elapsed) => {
          drawCover(ctx, img, img.naturalWidth, img.naturalHeight);
          drawOverlay(ctx, item, subtitle);
          report(elapsed);
          return elapsed >= PHOTO_MS;
        }, signal);
      } else {
        const video = await loadVideo(item.url);
        const source = audio!.createMediaElementSource(video);
        source.connect(audioOut!);
        await video.play();
        const limit = itemDuration(item) + VIDEO_SLACK_MS;
        await runFrames((elapsed) => {
          drawCover(ctx, video, video.videoWidth, video.videoHeight);
          drawOverlay(ctx, item, subtitle);
          report(Math.min(elapsed, itemDuration(item)));
          return video.ended || elapsed >= limit;
        }, signal);
        video.pause();
        source.disconnect();
        video.removeAttribute("src");
        video.load();
      }
      done += itemDuration(item);
    }
  } finally {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    await audio?.close();
  }

  if (signal.aborted) throw new DOMException("취소됨", "AbortError");
  onProgress(1);
  return new Blob(chunks, { type: support.mime });
}
