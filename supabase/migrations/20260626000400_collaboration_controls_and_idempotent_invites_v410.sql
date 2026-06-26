begin;

create or replace function public.accept_bogatka_project_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $function$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
  v_invite public.project_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Требуется вход в аккаунт.';
  end if;

  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Некорректная персональная ссылка.';
  end if;

  v_hash := encode(digest(lower(p_token), 'sha256'), 'hex');

  select *
  into v_invite
  from public.project_invites
  where token_hash = v_hash
  limit 1
  for update;

  if not found then
    raise exception 'Приглашение не найдено. Попросите владельца создать новую ссылку.';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'Это приглашение выдано для другого email.';
  end if;

  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = v_user and exists (
      select 1
      from public.project_members
      where project_id = v_invite.project_id
        and user_id = v_user
    ) then
      return v_invite.project_id;
    end if;
    raise exception 'Приглашение уже использовано или доступ был отключён.';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Приглашение отозвано. Попросите владельца создать новую ссылку.';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Срок действия приглашения истёк. Попросите владельца создать новую ссылку.';
  end if;

  if v_invite.role not in ('editor', 'viewer') then
    raise exception 'В приглашении указана недопустимая роль.';
  end if;

  insert into public.project_members (project_id, user_id, role, created_by)
  values (v_invite.project_id, v_user, v_invite.role, v_user)
  on conflict (project_id, user_id)
  do update set role = case
    when public.project_members.role = 'owner' then 'owner'
    else excluded.role
  end;

  update public.project_invites
  set accepted_at = now(),
      accepted_by = v_user
  where id = v_invite.id
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if not found then
    raise exception 'Приглашение уже недействительно.';
  end if;

  return v_invite.project_id;
end;
$function$;

create or replace function public.update_project_member_role(
  p_project_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if auth.uid() is null then
    raise exception 'Требуется вход в аккаунт.';
  end if;
  if not public.has_project_role(p_project_id, array['owner']) then
    raise exception 'Изменять роли может только владелец проекта.';
  end if;
  if p_role not in ('editor','viewer') then
    raise exception 'Допустимы только роли редактора и наблюдателя.';
  end if;
  if exists (
    select 1 from public.project_members
    where project_id=p_project_id and user_id=p_user_id and role='owner'
  ) then
    raise exception 'Роль владельца нельзя изменить.';
  end if;

  update public.project_members
  set role=p_role
  where project_id=p_project_id
    and user_id=p_user_id
    and role<>'owner';

  return found;
end;
$function$;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if auth.uid() is null then
    raise exception 'Требуется вход в аккаунт.';
  end if;
  if not public.has_project_role(p_project_id, array['owner']) then
    raise exception 'Отключать участников может только владелец проекта.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Нельзя отключить собственный аккаунт владельца.';
  end if;
  if exists (
    select 1 from public.project_members
    where project_id=p_project_id and user_id=p_user_id and role='owner'
  ) then
    raise exception 'Владельца проекта нельзя отключить.';
  end if;

  delete from public.project_members
  where project_id=p_project_id
    and user_id=p_user_id
    and role<>'owner';

  return found;
end;
$function$;

revoke all on function public.accept_bogatka_project_invite(text) from public, anon;
grant execute on function public.accept_bogatka_project_invite(text) to authenticated;
revoke all on function public.update_project_member_role(uuid,uuid,text) from public, anon;
grant execute on function public.update_project_member_role(uuid,uuid,text) to authenticated;
revoke all on function public.remove_project_member(uuid,uuid) from public, anon;
grant execute on function public.remove_project_member(uuid,uuid) to authenticated;

do $publication$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='project_members'
  ) then
    alter publication supabase_realtime add table public.project_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='project_invites'
  ) then
    alter publication supabase_realtime add table public.project_invites;
  end if;
end;
$publication$;

commit;
