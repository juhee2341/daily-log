"use client";

import { useState, useTransition } from "react";
import { revokeInvite } from "@/app/actions/invite";
import { approveMember, kickMember, rejectMember } from "@/app/actions/member";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";

export function PendingItem({
  sessionId,
  member,
  createdLabel,
}: {
  sessionId: string;
  member: { id: string; nickname: string; memo: string | null; inviteKind: "single" | "group" | null };
  createdLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof approveMember) =>
    startTransition(async () => {
      const result = await action(sessionId, member.id);
      if (!result.success) setError(result.error);
    });

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{member.nickname}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            member.inviteKind === "group" && "그룹 링크",
            member.memo,
            createdLabel && `${createdLabel}에 만든 링크`,
          ]
            .filter(Boolean)
            .join(" · ") || "메모 없음"}
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(rejectMember)}>
          거절
        </Button>
        <Button size="sm" disabled={pending} onClick={() => run(approveMember)}>
          승인
        </Button>
      </div>
    </li>
  );
}

export function KickButton({ sessionId, memberId, nickname }: { sessionId: string; memberId: string; nickname: string }) {
  return (
    <ConfirmButton
      label="내보내기"
      confirmLabel="내보내기"
      question={`${nickname}님의 기록이 모두 삭제돼요`}
      onConfirm={() => kickMember(sessionId, memberId)}
    />
  );
}

export function RevokeButton({ sessionId, inviteId }: { sessionId: string; inviteId: string }) {
  return (
    <ConfirmButton
      label="취소"
      confirmLabel="링크 취소"
      question="이 링크를 더 이상 못 쓰게 할까요?"
      onConfirm={() => revokeInvite(sessionId, inviteId)}
      variant="ghost"
    />
  );
}
