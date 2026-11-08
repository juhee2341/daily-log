-- 정기 작업 (Vercel Hobby의 하루 1회 Cron 제한을 피하려고 Supabase pg_cron 사용)
--   매시 정각         → POST {app_url}/api/cron/hourly  (슬롯 알림 푸시)
--   매일 00:05 KST    → POST {app_url}/api/cron/daily   (보관 기간 정리, 방장 14일 미접속 폭파)
--
-- 비밀값은 Vault에 저장한다 (git에 남기지 않음). 배포 후 SQL Editor에서 한 번 실행:
--   select vault.create_secret('https://<your-app>.vercel.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET과 같은 값>', 'cron_secret');
-- 값이 없으면 작업은 아무것도 하지 않는다.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.call_cron_endpoint(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.call_cron_endpoint(text) from public, anon, authenticated;

-- pg_cron은 UTC 기준. KST 00:05 = UTC 15:05
select cron.schedule('daily-log-hourly', '0 * * * *', $$select public.call_cron_endpoint('/api/cron/hourly')$$);
select cron.schedule('daily-log-daily', '5 15 * * *', $$select public.call_cron_endpoint('/api/cron/daily')$$);
