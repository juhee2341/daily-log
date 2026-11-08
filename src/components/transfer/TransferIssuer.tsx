"use client";

import QRCode from "qrcode";
import { useState, useTransition } from "react";
import { createTransferCode } from "@/app/actions/transfer";
import { Countdown } from "@/components/timeline/Countdown";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";

type Issued = { code: string; url: string; expiresAt: string; qr: string };

/** ID-4: 옛 기기에서 옮기기 코드와 QR을 보여준다. */
export function TransferIssuer() {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const now = useNow();
  const expired = issued && now !== null && now >= new Date(issued.expiresAt).getTime();

  const issue = () =>
    startTransition(async () => {
      setError(null);
      const result = await createTransferCode();
      if (!result.success) return setError(result.error);
      const qr = await QRCode.toDataURL(result.data.url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
      setIssued({ ...result.data, qr });
    });

  if (issued && !expired) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-4 text-center" role="status">
        {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 QR data URL */}
        <img src={issued.qr} alt="새 기기 카메라로 찍으면 옮기기 화면이 열리는 QR 코드" width={200} height={200} className="rounded-lg" />
        <p className="font-mono text-3xl font-bold tracking-widest" aria-label={`코드 ${issued.code.split("").join(" ")}`}>
          {issued.code}
        </p>
        <p className="text-xs text-muted-foreground">
          <Countdown target={issued.expiresAt} suffix=" 동안 쓸 수 있어요" />
        </p>
        <p className="text-sm leading-relaxed">
          새 기기에서 QR을 찍거나, daily-log 홈의 <strong>기기 옮기기</strong>에 코드를 입력하세요.
          <br />
          <span className="text-muted-foreground">옮기면 이 기기에서는 세션이 사라져요.</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setIssued(null)}>
          닫기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        휴대폰을 바꾸거나 브라우저를 바꿀 때, 참여 중인 세션(방장 권한 포함)을 새 기기로 옮겨요.
      </p>
      <Button variant="outline" onClick={issue} disabled={pending}>
        {pending ? "만드는 중..." : expired ? "코드가 만료됐어요 · 새로 만들기" : "새 기기로 옮길 코드 만들기"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
