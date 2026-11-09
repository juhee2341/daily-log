-- I-11: 그룹 초대 링크. 한 링크로 여러 명이 참여를 요청할 수 있다 (승인은 그대로 필요).
-- 개인 링크(single)는 기존처럼 1회용이고, 그룹 링크(group)는 만료·취소 전까지 계속 쓸 수 있다.

alter table public.invites
  add column kind text not null default 'single' check (kind in ('single', 'group'));

-- 그룹 링크는 거절돼도 링크가 살아 있으므로, "이 기기는 거절됨"을 링크별로 따로 기록한다.
create table public.invite_rejections (
  invite_id  uuid not null references public.invites on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

-- 클라이언트 접근 없음 (service role만)
alter table public.invite_rejections enable row level security;

create index members_invite_id_idx on public.members (invite_id) where invite_id is not null;
