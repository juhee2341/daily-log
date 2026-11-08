-- 초대 링크를 쓴 기기와 거절 여부를 남긴다 (I-4, I-10).
-- 거절되면 members 행은 삭제되므로, 같은 기기가 링크를 다시 열었을 때 "거절됨"을 보여주려면 여기에 기록이 필요하다.

alter table public.invites
  add column used_by uuid,
  add column rejected_at timestamptz;

create index invites_used_by_idx on public.invites (used_by) where used_by is not null;
