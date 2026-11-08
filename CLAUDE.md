@AGENTS.md

# daily-log

설치·가입 없이 링크 하나로 함께 쓰는, 매시간 찍는 데일리로그 웹.

## 문서

- **요구사항·데이터 모델·화면**: `docs/SPEC.md` (기능 ID: `S-1`, `P-4` 등으로 참조)

## 스택

- **Framework**: Next.js 16 (App Router, `src/app/`)
- **Language**: TypeScript strict
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (Postgres + RLS, 익명 로그인, Storage, Realtime Broadcast, pg_cron)
- **Validation**: zod (모든 boundary 입력 검증)
- **Time**: date-fns + `@date-fns/tz` — 슬롯·날짜는 항상 KST(`Asia/Seoul`) 기준, `src/lib/slot.ts`만 사용
- **Testing**: Jest + @testing-library/react + msw v2 (E2E 없음)
- **Package manager**: pnpm (npm 금지)
- **비용**: 무료 플랜만 사용 (Supabase Free, Vercel Hobby). 유료 기능 도입 전 반드시 확인

## 폴더 구조

```
src/
  app/                라우트·레이아웃
    api/              cron·push 등 외부 호출 엔드포인트만
    actions/          Server Actions (<domain>.ts)
  components/
    ui/               shadcn/ui (직접 수정 금지)
    <feature>/
  hooks/
  lib/
    auth.ts           requireUser() / requireMember() / requireHost()
    supabase/         server.ts · client.ts · admin.ts
    validators/       zod 스키마 — <domain>.schema.ts
  types/
  mocks/              msw
  test-utils/
supabase/migrations/  스키마·RLS·cron
```

**파일명**: 컴포넌트 `PascalCase`, 그 외 `kebab-case`, 테스트는 co-located.

## Scripts

- `pnpm dev` — 개발 서버
- `pnpm build` — 프로덕션 빌드
- `pnpm test` / `pnpm test:coverage` — Jest
- `pnpm lint` / `pnpm typecheck` — ESLint · TS 검사

## 환경 변수

- 서버 전용: 접두사 없음 (`SUPABASE_SECRET_KEY`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`)
- 클라이언트 노출: `NEXT_PUBLIC_*` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- 로컬: `.env.local` (커밋 금지). 템플릿은 `.env.example`

## 인증 모델 (로그인 없음)

- 모든 방문자는 Supabase **익명 로그인** 사용자. `user.id`가 곧 기기 신원
- `requireUser()` — 익명 세션 확인 (없으면 UNAUTHORIZED)
- `requireMember(sessionId)` — 해당 세션의 `active` 멤버인지 확인
- `requireHost(sessionId)` — 방장인지 확인 + `host_last_seen` 갱신(1시간 스로틀)
- **데이터 변경은 전부 Server Action / Route Handler에서** service role 클라이언트로 수행. 클라이언트는 읽기(RLS)와 Realtime 구독만
- 변경 후 Realtime Broadcast로 **변경 신호만** 발행 (내용·개인정보 금지). 클라이언트는 신호를 받으면 RLS 쿼리로 재조회. 이벤트 목록은 `docs/SPEC.md`

## 렌더링 전략

| 라우트 | 전략 |
|--------|------|
| 홈·세션·초대 진입 | Dynamic (쿠키 기반) + Suspense 스트리밍 |
| 타임라인·멤버·브이로그 | Dynamic + `no-store` + Realtime 구독 |

## 상태 위치 결정

```
서버 데이터?           → Server Component + Server Action + revalidate
실시간 반영?           → 초기값은 서버, 이후 Realtime 이벤트로 클라이언트 상태 갱신
URL 공유/새로고침?     → searchParams (날짜 탭, 브이로그 모드)
한 컴포넌트?           → useState
자주 안 변하고 넓게?   → Context
```

## z-index 스케일

`z-10` 헤더 · `z-20` 드롭다운 · `z-40` 모달 오버레이 · `z-50` 모달 · `z-[60]` 토스트 · `z-[70]` 툴팁

## 필수 사항

- 모든 async Server Component는 `<Suspense>` 경계 안에 배치
- 모든 Server Action / Route Handler는 진입 첫 줄에서 zod 파싱
- 모든 mutating Server Action은 `await requireUser()` (또는 `requireMember` / `requireHost`)로 시작
- `/api/cron/*`는 `Authorization: Bearer ${CRON_SECRET}` 검증
- 미디어 업로드: 서버가 경로(UUID)를 정하고 서명 URL 발급, 게시 시 용량·MIME·길이 재검증
- 사용자 노출 문구는 한국어

## 금지 사항

- `useEffect` for data fetching / derived state (Realtime 구독·카메라 등 외부 시스템 동기화는 예외)
- `React.FC` 타입 어노테이션
- `className` 문자열 `+` 연결 → `cn()` from `lib/utils`
- `console.log` 커밋
- `any` (정당한 이유 없이)
- Server Action에서 client로 `throw`
- 하드코딩된 hex 컬러
- Server Action `export default` (named export만)
- 클라이언트에 service role 키 노출

---

## Skills (프로젝트 커스텀)

`.claude/skills/<이름>/SKILL.md` — 관련 작업 시 로드.

| Skill | 트리거 |
|-------|--------|
| **security-standards** | Server Action / Route Handler / 업로드 / 초대 토큰 |
| **error-handling** | 에러 UI / Server Action 반환 |
| **form-patterns** | 폼 (세션 만들기, 닉네임, 코멘트, 댓글) |
| **a11y-standards** | UI 컴포넌트 |
| **testing-rules** | 테스트 작성 / 디버깅 |

## Agents (프로젝트 커스텀)

| Agent | 트리거 |
|-------|--------|
| **test-writer** | 테스트 작성·실행 |
| **code-reviewer** | 코드 리뷰 (버그·보안·성능·접근성 통합) |

Vercel 공식 스킬(`vercel:nextjs`, `vercel:shadcn`, `vercel:deploy` 등)은 플러그인으로 제공.
