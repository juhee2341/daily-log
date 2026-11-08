#!/usr/bin/env bash
# pg_cron이 호출할 앱 주소와 CRON_SECRET을 Supabase Vault에 등록하고, 실제로 한 번 호출해 확인한다.
# 사용: 로그인된 터미널에서 `pnpm setup:cron [앱 주소]` (기본: https://daily-log-silk.vercel.app)
# 비밀값은 화면에 출력하지 않는다. SQL은 권한 600 임시 파일로만 전달하고 바로 지운다.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_URL="${1:-https://daily-log-silk.vercel.app}"
SECRET="$(grep -E '^CRON_SECRET=' .env.local | tail -1 | cut -d= -f2- || true)"
[[ -n "$SECRET" ]] || { echo "❌ .env.local에 CRON_SECRET이 없어요."; exit 1; }
[[ "$APP_URL" =~ ^https:// ]] || { echo "❌ 앱 주소는 https:// 로 시작해야 해요."; exit 1; }

sb() { pnpm exec supabase "$@"; }

umask 077
SQL_FILE="$(mktemp)"
trap 'rm -f "$SQL_FILE"' EXIT

# 작은따옴표 이스케이프 (값에 '가 들어 있어도 안전하게)
q() { printf "%s" "$1" | sed "s/'/''/g"; }

cat > "$SQL_FILE" <<EOF
do \$\$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'app_url';
  if v_id is null then perform vault.create_secret('$(q "$APP_URL")', 'app_url');
  else perform vault.update_secret(v_id, '$(q "$APP_URL")'); end if;

  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then perform vault.create_secret('$(q "$SECRET")', 'cron_secret');
  else perform vault.update_secret(v_id, '$(q "$SECRET")'); end if;
end
\$\$;
EOF

echo "▶ Vault에 app_url · cron_secret 등록 ($APP_URL)"
sb db query --remote --yes -f "$SQL_FILE" >/dev/null

echo "▶ 등록된 정기 작업"
sb db query --remote --read-only "select jobname, schedule, active from cron.job order by jobname"

echo "▶ pg_cron 경로로 정리 작업을 한 번 호출해 확인"
sb db query --remote --yes "select public.call_cron_endpoint('/api/cron/daily')" >/dev/null
sleep 8
sb db query --remote --read-only "select status_code, left(content, 160) as body, created from net._http_response order by created desc limit 1"

echo
echo "✅ 완료 — status_code 200이면 정상이에요."
echo "   매시 정각: 촬영 알림 / 매일 00:05 KST: 정리 작업"
