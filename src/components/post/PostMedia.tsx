"use client";

import { useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { cn } from "@/lib/utils";

type Props = { type: "photo" | "video"; url: string; label: string };

/** 포스트 원본. 받아지기 전에는 자리를 잡아두고 로딩 표시를 보여준다 (레이아웃 밀림 방지). */
export function PostMedia({ type, url, label }: Props) {
  const [ready, setReady] = useState(false);
  const done = () => setReady(true);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-black", !ready && "aspect-[3/4]")}>
      {type === "video" ? (
        <video
          // 하이드레이션 전에 이미 받아진 경우 이벤트가 오지 않으므로 상태도 확인한다
          ref={(el) => {
            if (el && el.readyState >= 2) done();
          }}
          src={url}
          className={cn("max-h-[70dvh] w-full object-contain", !ready && "absolute inset-0 h-full opacity-0")}
          controls
          playsInline
          autoPlay
          loop
          muted
          onLoadedData={done}
          onError={done}
          aria-label={label}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 URL
        <img
          ref={(el) => {
            if (el?.complete && el.naturalWidth) done();
          }}
          src={url}
          alt={label}
          className={cn("max-h-[70dvh] w-full object-contain", !ready && "absolute inset-0 h-full opacity-0")}
          onLoad={done}
          onError={done}
        />
      )}
      {!ready && <Spinner label="불러오는 중" className="absolute inset-0 text-white/70" />}
    </div>
  );
}
