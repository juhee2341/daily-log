# daily-log 요구사항 명세 v1.1

> 설치·가입 없이 카톡 링크 하나로 시작하는, 매시간 함께 찍는 데일리로그 웹.
> 벤치마크: 셋로그(Setlog). 보관은 "오늘과 어제"뿐.

## 0. 포지셔닝 / 차별점

1. **설치·가입 없음** — 링크 열고 닉네임만 쓰면 참여. 여행·MT·워크숍·결혼식·축제처럼 잠깐 모인 그룹에 강함.
2. **인원 제한 없음** — 셋로그(최대 6명)와 달리 단체 행사에도 사용 가능.
3. **오늘과 어제만** — 이틀이면 사라지므로 부담 없이 날것으로 기록. 남기고 싶으면 브이로그 내보내기.
4. **하루 지도** — 멤버 × 24시간 점 그리드로 누가 언제 올렸는지 한눈에 보여줌.
5. **오늘의 미션** — 방장이 하루 한 줄 미션을 걸 수 있음.

## 1. 용어

| 용어 | 정의 |
|---|---|
| 세션 | 공유 공간 (셋로그의 "로그") |
| 방장 | 세션을 만든 사람. 1명이며 위임 불가 |
| 멤버 | 승인받고 들어온 참여자 (방장 포함) |
| 슬롯 | KST 기준 1시간 단위 구간 (예: 14:00~14:59) |
| 포스트 | 미디어 1개 + 코멘트(선택) |
| 댓글 | 포스트에 다는 답글 |

## 2. 신원 (로그인 없음)

- **ID-1** 첫 접속 시 Supabase 익명 로그인으로 익명 사용자 ID를 발급하고 쿠키에 저장한다.
- **ID-2** 닉네임은 세션마다 입력한다. 1~12자이며 **세션 안에서 중복될 수 없다**.
- **ID-3** 브라우저를 초기화하거나 기기를 바꾸면 다른 사람으로 인식된다(정책으로 수용). 대신 ID-4로 복구한다.
- **ID-4 내 기기 옮기기**: 기존 기기에서 10분 동안 유효한 1회용 코드(QR 포함)를 만든다. 새 기기에서 코드를 입력하면 기존 사용자의 **모든 세션 멤버십(방장 권한 포함)**이 새 기기로 옮겨진다.
- **ID-5 인앱 브라우저 탈출**: 카카오톡 등 인앱 브라우저를 감지하면 "기본 브라우저로 열기" 화면을 먼저 보여준다. Android 카톡은 외부 브라우저로 자동 전환하고, iOS는 버튼과 안내 문구로 처리한다.

## 3. 세션

- **S-1** 누구나 세션을 만들 수 있다. 입력값은 세션 이름(1~30자)과 방장 닉네임이다.
- **S-2** 한 사람이 여러 세션에 참여할 수 있으며, 홈 화면에 내 세션 목록을 보여준다.
- **S-3** 인원 제한은 없다.
- **S-4** 방장이 "세션 나가기"를 하면 세션이 즉시 폭파된다. **세션 이름을 직접 입력해야** 확정된다.
- **S-5** 폭파되면 포스트·미디어·댓글·초대 링크가 전부 삭제된다. 접속 중인 멤버에게는 실시간으로 안내 화면이 뜨고 홈으로 이동한다.
- **S-6** 방장이 **14일 동안 접속하지 않으면** 세션이 자동으로 폭파된다. **10일째부터** 방장 화면에 경고 배너를 띄운다.
- **S-7 오늘의 미션**: 방장은 날짜마다 한 줄 미션(50자 이하)을 설정하거나 수정할 수 있다. 미션은 타임라인 상단에 표시된다.

## 4. 초대와 멤버

- **I-1** 초대 링크는 방장만 만들 수 있다. 링크를 만들 때 방장만 보는 **메모**(20자 이하, 선택)를 붙일 수 있다.
- **I-2** 링크는 일회용이다. 누군가 닉네임을 제출하는 순간 사용 처리되고 다시 쓸 수 없다.
- **I-3** 쓰지 않은 링크는 만든 지 **24시간 뒤 만료**된다. 방장이 직접 취소할 수도 있다.
- **I-4** 링크를 연 사람은 닉네임 입력 → 승인 대기 화면으로 넘어간다. 같은 기기에서 다시 열면 대기 화면으로 이어서 돌아온다.
- **I-5** 방장의 승인 대기 목록에는 "닉네임 · 메모 · 링크 생성 시각"이 보인다. 방장은 승인하거나 거절한다. 거절하면 링크도 소멸된다.
- **I-6** 참여 화면에 "참여하면 내 포스트가 세션 브이로그에 포함되어 다른 멤버가 내보낼 수 있어요"라는 고지를 표시한다.
- **I-7** 방장은 멤버를 내보낼 수 있다. 일반 멤버는 스스로 나갈 수 있다.
- **I-8** 나가거나 내보내지면 **그 사람의 포스트·미디어·댓글이 전부 삭제**된다.
- **I-9** 나간 사람도 새 링크를 받고 다시 승인받으면 재참여할 수 있다. 이전 기록은 복구되지 않는다.
- **I-10** 링크 상태별 안내 화면을 둔다: 만료됨 / 이미 사용됨 / 거절됨 / 세션 없음(폭파).

## 5. 포스트

- **P-1** **카메라로 바로 촬영한 것만** 올릴 수 있다. 웹 안의 자체 카메라 화면(getUserMedia + MediaRecorder)을 쓰고, 파일 선택창은 쓰지 않는다.
- **P-2** 미디어는 사진 1장 또는 영상 1개(**2초 이상 10초 이하**)다. 녹화는 10초가 되면 자동으로 멈추고, 2초 미만이면 업로드할 수 없다.
- **P-3** 코멘트는 100자 이하이며 선택 사항이다.
- **P-4** 슬롯 규칙
  - 한 사람은 슬롯마다 1개만 올릴 수 있다.
  - 지나간 슬롯에는 올릴 수 없다.
  - 슬롯은 **셔터를 누른 시점의 서버 시각**으로 정해진다(촬영 티켓). 셔터를 누른 뒤 5분 안에 게시해야 한다.
- **P-5** 게시 후 **3분 동안만 "올리기 취소"**를 할 수 있다. 취소하면 흔적 없이 삭제되고 그 슬롯에 다시 올릴 수 있다. 3분이 지나면 삭제할 수 없다(I-8 예외).
- **P-6** 자기가 올린 미디어 원본은 다운로드할 수 있다.
- **P-7** 새 포스트·댓글·멤버 변화는 실시간으로 반영된다.

## 6. 댓글

- **C-1** 멤버 모두 댓글을 달 수 있다(100자 이하). 오늘과 어제 포스트 모두에 달 수 있다.
- **C-2** 자기가 쓴 댓글은 삭제할 수 있다. 삭제하면 그 자리에 "삭제된 댓글입니다"라고 흔적이 남는다.
- **C-3** 좋아요는 없다.

## 7. 브이로그

- **V-1** 하루치 포스트를 시간순으로 이어서 재생한다. 모드는 두 가지다.
  - **전체 모드**: 모든 멤버의 포스트를 시간순으로 섞어서 재생
  - **멤버별 모드**: 멤버 한 명의 하루만 재생
- **V-2** 사진은 2초 동안 보여준다. 재생 중에는 시각, 닉네임, 코멘트가 겹쳐서 표시된다.
- **V-3** 조작: 오른쪽 탭은 다음, 왼쪽 탭은 이전, 길게 누르면 일시정지. "탭해서 시작"으로 소리를 켠다.
- **V-4** **내보내기**: 전체 모드와 멤버별 모드 모두 mp4(지원되지 않으면 webm)로 저장할 수 있다. 브라우저 안에서 canvas + MediaRecorder로 렌더링하므로 서버 비용이 없다. 세로 9:16 형식이다.

## 8. 하루 지도

- **M-1** 날짜(오늘/어제) 탭 안에서 멤버(행) × 0~23시(열) 점 그리드로 보여준다.
- **M-2** 올린 칸은 채워진 점으로 표시하고, 탭하면 해당 포스트가 열린다. 현재 슬롯은 강조 표시한다.

## 9. 알림 (선택형 웹 푸시)

- **N-1** 사용자가 직접 켜는 방식이다. 기기 단위로 설정한다.
- **N-2** 매 정각에 "지금 찍을 시간"이라고 알린다. 해당 사용자가 참여 중인 세션이 하나라도 있고, 그 세션들에서 해당 슬롯에 아직 올리지 않았을 때만 보낸다.
- **N-3** 방해금지 시간대를 둔다. 기본값은 01:00~08:00(KST)이며 변경할 수 있다.
- **N-4** iOS는 홈 화면에 추가(PWA)했을 때만 동작한다. iOS에서 알림을 켜려고 하면 홈 화면 추가 방법을 안내한다.

## 10. 데이터 보관

- **D-1** 오늘과 어제 데이터만 보관한다. 그저께 이전의 포스트·미디어·댓글·미션은 매일 자동으로 삭제된다.
- **D-2** 날짜는 KST 00:00 기준으로 바뀐다.

## 11. 범위에서 뺀 것

좋아요, 방장 위임, 포스트 수정, (3분 이후) 포스트 삭제, 로그인, 갤러리 업로드, 신고 기능, 다국어·타임존 설정

---

# 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + TypeScript, pnpm |
| 익명 신원 | Supabase 익명 로그인 (`@supabase/ssr`, 쿠키) |
| DB | Supabase Postgres (+ RLS) |
| 미디어 | Supabase Storage (서명된 업로드 URL로 직접 업로드) |
| 실시간 | Supabase Realtime Broadcast, 공개 채널 `session:{id}`, `join:{memberId}` — **변경 신호만** 전송, 내용은 RLS 쿼리로 재조회 |
| 정기 작업 | Supabase pg_cron + pg_net → Next.js `/api/cron/*` 호출 (매시 정각: 푸시 / 매일 00:05 KST: 정리) |
| 푸시 | Web Push (VAPID, `web-push`) + 서비스 워커 |
| UI | Tailwind CSS v4 |
| 검증·시간 | zod, date-fns + `@date-fns/tz` |
| 배포 | Vercel |

## 구현 원칙

- **데이터 변경은 전부 Next.js 서버(Server Actions / Route Handlers)를 거친다.** 클라이언트는 읽기와 실시간 구독만 한다.
- 서버는 변경 후 Realtime Broadcast로 **내용 없는 변경 신호**(`{ type }`, 필요 시 대상 id)를 발행한다. 클라이언트는 신호를 받으면 RLS로 보호된 쿼리로 다시 읽는다. 채널 이름을 알아도 멤버가 아니면 내용을 볼 수 없다.
  - `session:{id}` 이벤트: `post.created`, `post.deleted`, `comment.created`, `comment.deleted`, `member.pending`, `member.joined`, `member.left`, `mission.updated`, `session.destroyed`
  - `join:{memberId}` 이벤트: `member.approved`, `member.rejected`
- 영상 길이(2~10초)는 클라이언트가 강제하고, 서버는 `duration_ms` 범위와 파일 용량 상한(영상 20MB, 사진 5MB)을 검사한다.
- 미디어 저장 경로: `media/{sessionId}/{memberId}/{postId}.{ext}`, 썸네일은 `{postId}_thumb.jpg`

---

# 데이터 모델

```sql
sessions (
  id              uuid pk,
  name            varchar(30) not null,
  host_user_id    uuid not null,
  host_last_seen  timestamptz not null,        -- 최대 1시간에 한 번만 갱신
  created_at      timestamptz not null
)

invites (
  id          uuid pk,
  session_id  uuid fk → sessions on delete cascade,
  token_hash  text unique not null,
  memo        varchar(20),
  status      'open' | 'used' | 'revoked',
  created_at  timestamptz not null,
  expires_at  timestamptz not null,            -- created_at + 24h, 조회 시 비교
  used_at     timestamptz
)

members (
  id          uuid pk,
  session_id  uuid fk → sessions on delete cascade,
  user_id     uuid not null,
  invite_id   uuid fk → invites on delete set null,
  nickname    varchar(12) not null,
  role        'host' | 'member',
  status      'pending' | 'active',
  joined_at   timestamptz,
  created_at  timestamptz not null,
  unique (session_id, user_id),
  unique (session_id, nickname)
)
-- 나가기 / 내보내기 / 거절 = 행 삭제 → posts, comments 연쇄 삭제

missions (
  session_id  uuid fk → sessions on delete cascade,
  log_date    date not null,
  body        varchar(50) not null,
  updated_at  timestamptz not null,
  primary key (session_id, log_date)
)

capture_tickets (
  id          uuid pk,
  member_id   uuid fk → members on delete cascade,
  slot_start  timestamptz not null,
  post_id     uuid not null,                   -- 미리 발급한 포스트 ID (저장 경로용)
  issued_at   timestamptz not null,
  expires_at  timestamptz not null,            -- issued_at + 5분
  used        boolean not null default false
)

posts (
  id          uuid pk,
  session_id  uuid fk → sessions on delete cascade,
  member_id   uuid fk → members on delete cascade,
  slot_start  timestamptz not null,
  log_date    date not null,                   -- KST 날짜
  media_type  'photo' | 'video',
  media_path  text not null,
  thumb_path  text not null,
  mime_type   text not null,
  duration_ms int,                             -- 영상만, 2000~10000
  caption     varchar(100),
  created_at  timestamptz not null,            -- +3분까지 올리기 취소 가능
  unique (member_id, slot_start)
)

comments (
  id          uuid pk,
  post_id     uuid fk → posts on delete cascade,
  member_id   uuid fk → members on delete cascade,
  body        varchar(100),                    -- 삭제 시 null
  deleted_at  timestamptz,
  created_at  timestamptz not null
)

transfer_codes (
  code_hash     text pk,
  from_user_id  uuid not null,
  expires_at    timestamptz not null,          -- +10분
  used_at       timestamptz
)

push_subscriptions (
  id           uuid pk,
  user_id      uuid not null,
  endpoint     text unique not null,
  p256dh       text not null,
  auth         text not null,
  quiet_start  smallint not null default 1,    -- KST 시
  quiet_end    smallint not null default 8,
  created_at   timestamptz not null
)
```

## 삭제 처리

| 상황 | DB | 저장소 |
|---|---|---|
| 올리기 취소 (3분 이내) | posts 행 삭제 | 해당 파일 즉시 삭제 |
| 멤버 나가기·내보내기 | members 행 삭제 → 연쇄 삭제 | `{sessionId}/{memberId}/` 경로 삭제 |
| 세션 폭파 | sessions 행 삭제 → 연쇄 삭제 | `{sessionId}/` 경로 삭제 |
| 매일 00:05 KST | `log_date < 어제`인 posts·missions 삭제, 방장 14일 미접속 세션 폭파, 만료된 티켓·이전 코드 정리 | 해당 파일 삭제 + 고아 파일 정리 |

---

# 화면

| 경로 | 화면 |
|---|---|
| `/` | 홈: 내 세션 목록, 세션 만들기, 기기 옮기기 코드 입력 |
| `/new` | 세션 만들기 |
| `/join/[token]` | 초대 진입: 닉네임 입력, 승인 대기, 링크 상태 안내 |
| `/s/[id]` | 타임라인: 오늘/어제 탭, 미션, 슬롯별 포스트, 촬영 버튼 |
| `/s/[id]/map` | 하루 지도 |
| `/s/[id]/capture` | 촬영 → 미리보기 → 코멘트 → 게시 |
| `/s/[id]/p/[postId]` | 포스트 상세와 댓글 |
| `/s/[id]/vlog` | 브이로그 재생과 내보내기 |
| `/s/[id]/members` | 멤버 목록·나가기, (방장) 초대 링크·승인 대기·내보내기·미션 |
| `/settings` | 알림 설정, 기기 옮기기 코드 만들기 |

# 구현 순서

1. 스캐폴딩 ✅
2. DB 마이그레이션 + RLS + Storage 버킷 ✅
3. 익명 신원 + 세션 만들기 + 홈 ✅
4. 초대·승인·멤버 관리 (+ 인앱 브라우저 탈출) ✅
5. 촬영 + 타임라인 + 올리기 취소 ✅
6. 댓글 + 실시간 ✅
7. 하루 지도 + 미션 ✅
8. 브이로그 재생 + 내보내기
9. 웹 푸시 + PWA
10. 기기 옮기기
11. Cron (정리·자동 폭파·푸시)
