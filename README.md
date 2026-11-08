# daily-log

설치·가입 없이 링크 하나로, 매시간 함께 찍는 오늘과 어제의 기록.

- 프로덕션: https://daily-log-silk.vercel.app
- 요구사항·데이터 모델: [`docs/SPEC.md`](docs/SPEC.md)
- 작업 규칙: [`CLAUDE.md`](CLAUDE.md)

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 + shadcn/ui · Supabase (Postgres, 익명 로그인, Storage, Realtime, pg_cron) · Vercel. 모두 무료 플랜.

## 로컬 개발

```bash
pnpm install
pnpm setup:supabase   # 최초 1회: Supabase 프로젝트 생성·연결·마이그레이션·.env.local 작성 (supabase login 필요)
pnpm dev
```

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm test` | Jest |
| `pnpm lint` / `pnpm typecheck` | ESLint · TS 검사 |
| `pnpm db:push` | 새 마이그레이션을 원격 DB에 적용 (로그인된 터미널) |
| `pnpm db:types` | DB 타입 재생성 (로그인된 터미널) |

## 배포

GitHub `main`에 push하면 Vercel이 프로덕션에 배포한다. 다른 브랜치는 미리보기 배포.
환경 변수는 Vercel 프로젝트에 등록돼 있다 (`.env.example` 참고).
