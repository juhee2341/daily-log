-- ID-4: 기기 옮기기. 코드 1회 사용 처리와 멤버십·방장 권한 이전을 한 트랜잭션으로 처리한다.
-- 새 기기가 이미 참여 중인 세션은 옮기지 않는다 (새 기기의 기존 기록을 지키기 위해) → skipped로 알려준다.

create function public.transfer_identity(p_code_hash text, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from    uuid;
  v_moved   int := 0;
  v_skipped int := 0;
begin
  select from_user_id into v_from
  from public.transfer_codes
  where code_hash = p_code_hash and used_at is null and expires_at > now();

  if v_from is null then
    return jsonb_build_object('error', 'invalid');
  end if;
  -- 같은 기기에서 입력한 경우: 코드는 소모하지 않는다
  if v_from = p_to then
    return jsonb_build_object('error', 'same_device');
  end if;

  -- 동시에 두 기기가 입력해도 한 곳만 성공하도록 조건부로 차지한다
  update public.transfer_codes
  set used_at = now()
  where code_hash = p_code_hash and used_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;

  select count(*) into v_skipped
  from public.members m
  where m.user_id = v_from
    and exists (select 1 from public.members n where n.session_id = m.session_id and n.user_id = p_to);

  update public.sessions s
  set host_user_id = p_to, host_last_seen = now()
  where s.host_user_id = v_from
    and not exists (select 1 from public.members n where n.session_id = s.id and n.user_id = p_to);

  update public.members m
  set user_id = p_to
  where m.user_id = v_from
    and not exists (select 1 from public.members n where n.session_id = m.session_id and n.user_id = p_to);
  get diagnostics v_moved = row_count;

  -- 옛 기기의 남은 옮기기 코드는 모두 무효화
  update public.transfer_codes set used_at = now() where from_user_id = v_from and used_at is null;

  return jsonb_build_object('moved', v_moved, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.transfer_identity(text, uuid) from public, anon, authenticated;
