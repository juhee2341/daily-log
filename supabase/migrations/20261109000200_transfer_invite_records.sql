-- ID-4 + I-11: 기기 옮기기 때 초대 링크 기록(사용한 기기, 그룹 링크 거절)도 새 기기로 옮긴다.
-- 나머지 동작은 20261109000000_transfer_identity.sql과 같다.

create or replace function public.transfer_identity(p_code_hash text, p_to uuid)
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

  -- 초대 링크 기록도 새 기기로: 개인 링크를 쓴 기기, 그룹 링크에서 거절·내보내기된 기기 (I-11)
  -- 기기를 옮기는 것으로 거절을 피해 가지 못하게 한다.
  update public.invites set used_by = p_to where used_by = v_from;
  insert into public.invite_rejections (invite_id, user_id, created_at)
  select r.invite_id, p_to, r.created_at
  from public.invite_rejections r
  where r.user_id = v_from
  on conflict (invite_id, user_id) do nothing;
  delete from public.invite_rejections where user_id = v_from;

  -- 옛 기기의 남은 옮기기 코드는 모두 무효화
  update public.transfer_codes set used_at = now() where from_user_id = v_from and used_at is null;

  return jsonb_build_object('moved', v_moved, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.transfer_identity(text, uuid) from public, anon, authenticated;
