begin;

-- Membership must not be creatable merely because an email has an active invite.
-- The raw one-time token is verified only inside the SECURITY DEFINER RPC below.
drop policy if exists "invited account can join project" on public.project_members;

create or replace function public.claim_bogatka_project()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_member_count integer;
begin
  if v_user is null then
    raise exception 'Требуется вход в аккаунт.';
  end if;

  select id
  into v_project
  from public.projects
  where slug = 'bogatka-grodno';

  if v_project is null then
    insert into public.projects (slug, name, description, created_by)
    values (
      'bogatka-grodno',
      'Богатка — Гродно и Гродненская область',
      'Осмотр, сравнение и запуск локаций сети зоомагазинов',
      v_user
    )
    returning id into v_project;
  end if;

  select count(*)
  into v_member_count
  from public.project_members
  where project_id = v_project;

  if v_member_count = 0 then
    insert into public.project_members (project_id, user_id, role, created_by)
    values (v_project, v_user, 'owner', v_user)
    on conflict (project_id, user_id)
    do update set role = 'owner';
  elsif not exists (
    select 1
    from public.project_members
    where project_id = v_project
      and user_id = v_user
  ) then
    raise exception 'Проект уже создан. Используйте действующее персональное приглашение владельца.';
  end if;

  return v_project;
end;
$function$;

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

  if v_invite.revoked_at is not null then
    raise exception 'Приглашение отозвано. Попросите владельца создать новую ссылку.';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Приглашение уже использовано.';
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

revoke all on function public.accept_bogatka_project_invite(text) from public;
revoke all on function public.accept_bogatka_project_invite(text) from anon;
grant execute on function public.accept_bogatka_project_invite(text) to authenticated;

commit;
