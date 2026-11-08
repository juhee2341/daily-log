#!/usr/bin/env bash
# Supabase Free 프로젝트를 만들고 이 저장소에 연결한다.
#   1. 프로젝트 생성 (Seoul, ap-northeast-2)  2. 연결  3. config.toml 반영(익명 로그인 ON)
#   4. 마이그레이션 적용  5. .env.local 작성
# 비밀값은 화면에 출력하지 않고 .env.local(커밋 금지)에만 기록한다.
# 사용: 로그인된 터미널에서 `pnpm setup:supabase`
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="${PROJECT_NAME:-daily-log}"
REGION="ap-northeast-2"
ENV_FILE=".env.local"
sb() { pnpm exec supabase "$@"; }

# JSON 출력에서 값 꺼내기: json_get '<js expression>'
#   d = 파싱된 JSON, L = 목록(배열이면 그대로, 객체면 안의 첫 배열)
json_get() { node -e 'let s=require("fs").readFileSync(0,"utf8");const i=Math.min(...["[","{"].map(c=>{const j=s.indexOf(c);return j<0?1e9:j}));const d=JSON.parse(s.slice(i));const L=Array.isArray(d)?d:(Object.values(d).find(Array.isArray)||[]);const v=('"$1"');if(v==null||v==="")process.exit(1);console.log(v)'; }

if [[ -f "$ENV_FILE" ]] && grep -q '^NEXT_PUBLIC_SUPABASE_URL=.\+' "$ENV_FILE"; then
  echo "❌ $ENV_FILE 에 이미 Supabase 설정이 있어요. 새로 만들려면 파일을 옮긴 뒤 다시 실행하세요."
  exit 1
fi

echo "▶ 로그인 확인"
ORGS_JSON="$(sb orgs list -o json)" || { echo "❌ 먼저 'pnpm exec supabase login'을 실행하세요."; exit 1; }

ORG_COUNT="$(printf '%s' "$ORGS_JSON" | json_get 'String(L.length)')" || {
  echo "❌ 조직 목록을 해석하지 못했어요. 아래 출력을 Claude에게 붙여주세요:"
  printf '%s\n' "$ORGS_JSON"
  exit 1
}
if [[ "$ORG_COUNT" == "0" ]]; then
  echo "▶ 조직이 없어서 새로 만들어요: $PROJECT_NAME (Free)"
  ORG_JSON="$(sb orgs create "$PROJECT_NAME" --yes -o json)"
  ORG_ID="$(printf '%s' "$ORG_JSON" | json_get 'd.id ?? d.slug')"
elif [[ "$ORG_COUNT" == "1" ]]; then
  ORG_ID="$(printf '%s' "$ORGS_JSON" | json_get 'L[0].id ?? L[0].slug')"
else
  echo "조직이 여러 개예요:"
  printf '%s' "$ORGS_JSON" | json_get 'L.map((o,i)=>`  ${i+1}) ${o.name} (${o.id ?? o.slug})`).join("\n")'
  read -r -p "번호 선택: " PICK
  ORG_ID="$(printf '%s' "$ORGS_JSON" | json_get "L[$((PICK-1))].id ?? L[$((PICK-1))].slug")"
fi
echo "  조직: $ORG_ID"

DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)"

echo "▶ 프로젝트 생성: $PROJECT_NAME ($REGION, Free)"
CREATE_JSON="$(sb projects create "$PROJECT_NAME" --org-id "$ORG_ID" --db-password "$DB_PASSWORD" --region "$REGION" --yes -o json)"
REF="$(printf '%s' "$CREATE_JSON" | json_get 'd.ref ?? d.id')"
echo "  ref: $REF"

# 비밀번호는 생성 직후 바로 저장해서, 중간에 실패해도 잃어버리지 않게 한다
umask 077
cat > "$ENV_FILE" <<EOF
# scripts/setup-supabase.sh 가 생성 — 커밋 금지
SUPABASE_PROJECT_REF=$REF
SUPABASE_DB_PASSWORD=$DB_PASSWORD
EOF

echo "▶ 프로젝트 준비 대기 (보통 1~3분)"
STATUS=""
for i in $(seq 1 60); do
  STATUS="$(sb projects list -o json | json_get "(L.find(p=>(p.ref??p.id)==='$REF')||{}).status" || true)"
  [[ "$STATUS" == "ACTIVE_HEALTHY" ]] && break
  printf '  %s (%ss)\r' "${STATUS:-PENDING}" "$((i*5))"
  sleep 5
done
[[ "$STATUS" == "ACTIVE_HEALTHY" ]] || { echo "❌ 5분 안에 준비되지 않았어요. 잠시 뒤 다시 확인하세요 (ref: $REF)."; exit 1; }
echo

echo "▶ 연결"
SUPABASE_DB_PASSWORD="$DB_PASSWORD" sb link --project-ref "$REF"

echo "▶ config.toml 반영 (익명 로그인 ON)"
sb config push --yes

echo "▶ 마이그레이션 적용"
sb db push --remote --password "$DB_PASSWORD" --yes

echo "▶ API 키 → $ENV_FILE"
KEYS_JSON="$(sb projects api-keys --remote="$REF" --reveal -o json)"
PUBLISHABLE="$(printf '%s' "$KEYS_JSON" | json_get '(L.find(k=>k.type==="publishable")||L.find(k=>k.name==="anon")).api_key')"
SECRET="$(printf '%s' "$KEYS_JSON" | json_get '(L.find(k=>k.type==="secret")||L.find(k=>k.name==="service_role")).api_key')"
VAPID_JSON="$(pnpm exec web-push generate-vapid-keys --json)"

cat >> "$ENV_FILE" <<EOF

NEXT_PUBLIC_SUPABASE_URL=https://$REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE
SUPABASE_SECRET_KEY=$SECRET

CRON_SECRET=$(openssl rand -hex 32)

NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(printf '%s' "$VAPID_JSON" | json_get 'd.publicKey')
VAPID_PRIVATE_KEY=$(printf '%s' "$VAPID_JSON" | json_get 'd.privateKey')
VAPID_SUBJECT=mailto:you@example.com
EOF

echo
echo "✅ 완료 — ref: $REF"
echo "   대시보드: https://supabase.com/dashboard/project/$REF"
echo "   비밀값은 $ENV_FILE 에만 저장됐어요 (화면 출력 없음)."
