"use client";

import { useActionState, useState } from "react";
import { setMission } from "@/app/actions/mission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MISSION_MAX } from "@/lib/validators/mission.schema";

type State = Awaited<ReturnType<typeof setMission>> | null;
type Props = { sessionId: string; mission: string | null; canEdit: boolean };

/** S-7: 타임라인 상단의 오늘의 미션. 방장은 오늘 미션을 정하거나 고칠 수 있다. */
export function MissionCard({ sessionId, mission, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const result = await setMission(formData);
    if (result.success) setEditing(false);
    return result;
  }, null);
  const failed = state && !state.success ? state : null;
  const error = failed?.fieldErrors?.body?.[0] ?? failed?.error;

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-2 rounded-xl border p-3" noValidate>
        <input type="hidden" name="sessionId" value={sessionId} />
        <label htmlFor="mission" className="text-xs font-semibold text-muted-foreground">
          오늘의 미션 (비우면 지워져요)
        </label>
        <Input
          id="mission"
          name="body"
          defaultValue={mission ?? ""}
          maxLength={MISSION_MAX}
          placeholder="예: 점심 메뉴 찍기"
          autoComplete="off"
          autoFocus
          aria-invalid={!!error}
          aria-describedby={error ? "mission-error" : undefined}
          className="h-10"
        />
        {error && (
          <p id="mission-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
            취소
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    );
  }

  if (!mission && !canEdit) return null;

  return (
    <section aria-label="오늘의 미션" className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
      <span aria-hidden className="text-lg">
        🎯
      </span>
      <p className="min-w-0 flex-1 text-sm">
        {mission ? (
          <>
            <span className="block text-xs font-semibold text-muted-foreground">오늘의 미션</span>
            <span className="break-words">{mission}</span>
          </>
        ) : (
          <span className="text-muted-foreground">오늘의 미션을 걸어보세요</span>
        )}
      </p>
      {canEdit && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {mission ? "수정" : "정하기"}
        </Button>
      )}
    </section>
  );
}
