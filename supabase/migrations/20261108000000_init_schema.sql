-- daily-log 초기 스키마 (docs/SPEC.md "데이터 모델")
-- 쓰기는 전부 서버(service role)에서만 수행한다. 클라이언트는 RLS로 허용된 읽기와 Realtime 구독만 한다.

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  name           varchar(30) not null check (char_length(btrim(name)) between 1 and 30),
  host_user_id   uuid not null,
  host_last_seen timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions on delete cascade,
  token_hash  text not null unique,
  memo        varchar(20),
  status      text not null default 'open' check (status in ('open', 'used', 'revoked')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  used_at     timestamptz
);

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions on delete cascade,
  user_id     uuid not null,
  invite_id   uuid references public.invites on delete set null,
  nickname    varchar(12) not null check (char_length(btrim(nickname)) between 1 and 12),
  role        text not null default 'member' check (role in ('host', 'member')),
  status      text not null default 'pending' check (status in ('pending', 'active')),
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, nickname),
  check (role = 'member' or status = 'active')
);

-- 세션당 방장은 정확히 1명
create unique index members_one_host_per_session on public.members (session_id) where role = 'host';

create table public.missions (
  session_id  uuid not null references public.sessions on delete cascade,
  log_date    date not null,
  body        varchar(50) not null check (char_length(btrim(body)) between 1 and 50),
  updated_at  timestamptz not null default now(),
  primary key (session_id, log_date)
);

create table public.capture_tickets (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members on delete cascade,
  slot_start  timestamptz not null,
  post_id     uuid not null unique,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '5 minutes',
  used        boolean not null default false
);

create table public.posts (
  id          uuid primary key,                         -- capture_tickets.post_id
  session_id  uuid not null references public.sessions on delete cascade,
  member_id   uuid not null references public.members on delete cascade,
  slot_start  timestamptz not null check (date_trunc('hour', slot_start) = slot_start),
  log_date    date not null,
  media_type  text not null check (media_type in ('photo', 'video')),
  media_path  text not null,
  thumb_path  text not null,
  mime_type   text not null,
  duration_ms int,
  caption     varchar(100),
  created_at  timestamptz not null default now(),
  unique (member_id, slot_start),
  check (
    (media_type = 'video' and duration_ms between 2000 and 10000)
    or (media_type = 'photo' and duration_ms is null)
  )
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts on delete cascade,
  member_id   uuid not null references public.members on delete cascade,
  body        varchar(100),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 100)
    or (deleted_at is not null and body is null)
  )
);

create table public.transfer_codes (
  code_hash     text primary key,
  from_user_id  uuid not null,
  expires_at    timestamptz not null default now() + interval '10 minutes',
  used_at       timestamptz
);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  quiet_start smallint not null default 1 check (quiet_start between 0 and 23),
  quiet_end   smallint not null default 8 check (quiet_end between 0 and 23),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────

create index members_user_id_idx on public.members (user_id);
create index invites_session_id_idx on public.invites (session_id);
create index posts_session_date_idx on public.posts (session_id, log_date, slot_start);
create index posts_log_date_idx on public.posts (log_date);
create index comments_post_id_idx on public.comments (post_id, created_at);
create index comments_member_id_idx on public.comments (member_id);
create index capture_tickets_member_id_idx on public.capture_tickets (member_id);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index sessions_host_last_seen_idx on public.sessions (host_last_seen);

-- ─────────────────────────────────────────────
-- RLS helpers
-- ─────────────────────────────────────────────

-- 정책 안에서 잘못된 토픽·경로가 들어와도 예외 대신 null을 돌려주는 캐스트
create function public.try_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_value::uuid
  end;
$$;

create function public.is_active_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where session_id = p_session_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

revoke execute on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RLS: 읽기만 허용, 쓰기 정책 없음(= service role 전용)
-- ─────────────────────────────────────────────

alter table public.sessions enable row level security;
alter table public.invites enable row level security;
alter table public.members enable row level security;
alter table public.missions enable row level security;
alter table public.capture_tickets enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.transfer_codes enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "members read their sessions" on public.sessions
  for select to authenticated
  using (public.is_active_member(id));

create policy "members read session members" on public.members
  for select to authenticated
  using (user_id = auth.uid() or public.is_active_member(session_id));

create policy "members read missions" on public.missions
  for select to authenticated
  using (public.is_active_member(session_id));

create policy "members read posts" on public.posts
  for select to authenticated
  using (public.is_active_member(session_id));

create policy "members read comments" on public.comments
  for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_active_member(p.session_id)
    )
  );

-- invites, capture_tickets, transfer_codes, push_subscriptions: 클라이언트 접근 없음

-- ─────────────────────────────────────────────
-- Realtime: 공개 Broadcast 채널에 "변경 신호"만 보낸다 (내용 없음)
--   session:{sessionId}  예: { type: "post.created" }
--   join:{memberId}      예: { type: "member.approved" }
-- 클라이언트는 신호를 받으면 RLS로 보호된 쿼리로 다시 읽는다.
-- realtime.messages 는 새 프로젝트에 바로 생기지 않으므로 여기서 의존하지 않는다.
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- Storage: media/{sessionId}/{memberId}/{postId}.{ext}
-- 업로드는 서버가 발급한 서명 URL로만 한다. 읽기는 해당 세션 멤버만.
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  20 * 1024 * 1024,
  array['image/jpeg', 'image/webp', 'video/mp4', 'video/webm']
);

create policy "members read session media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and public.is_active_member(public.try_uuid((storage.foldername(name))[1]))
  );
