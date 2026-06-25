begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (project_id, user_id)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id text,
  title text not null,
  address text,
  note text,
  status text,
  object_type text,
  form_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  revision bigint not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (project_id, client_id)
);

create index if not exists locations_project_sort_idx on public.locations(project_id, sort_order, created_at);
create index if not exists locations_project_status_idx on public.locations(project_id, status);
create index if not exists locations_updated_idx on public.locations(project_id, updated_at desc);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  category text not null default 'other',
  caption text,
  storage_path text not null unique,
  original_name text,
  mime_type text,
  width integer,
  height integer,
  file_size bigint,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists photos_location_category_idx on public.photos(location_id, category, sort_order, created_at);
create index if not exists photos_project_idx on public.photos(project_id, created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Отчёт по локациям',
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists reports_project_created_idx on public.reports(project_id, created_at desc);
create index if not exists reports_public_token_idx on public.reports(public_token);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_project_created_idx on public.activity_log(project_id, created_at desc);
create index if not exists activity_log_location_created_idx on public.activity_log(location_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles(id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', split_part(coalesce(email,''), '@', 1))
from auth.users
on conflict (id) do update
set email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  );
$$;

create or replace function public.has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = any(p_roles)
  );
$$;

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.claim_bogatka_project()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_member_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select id into v_project from public.projects where slug = 'bogatka-grodno';

  if v_project is null then
    insert into public.projects(slug, name, description, created_by)
    values ('bogatka-grodno', 'Богатка — Гродно и Гродненская область', 'Осмотр, сравнение и запуск локаций сети зоомагазинов', v_user)
    returning id into v_project;
  end if;

  select count(*) into v_member_count from public.project_members where project_id = v_project;

  if v_member_count = 0 then
    insert into public.project_members(project_id, user_id, role, created_by)
    values (v_project, v_user, 'owner', v_user)
    on conflict (project_id, user_id) do update set role = 'owner';
  elsif not exists (
    select 1 from public.project_members where project_id = v_project and user_id = v_user
  ) then
    raise exception 'Project is already claimed. Ask the owner to add this account.';
  end if;

  return v_project;
end;
$$;

create or replace function public.add_project_member_by_email(p_project_id uuid, p_email text, p_role text default 'editor')
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
begin
  if not public.has_project_role(p_project_id, array['owner']) then
    raise exception 'Owner role required';
  end if;
  if p_role not in ('owner','editor','viewer') then
    raise exception 'Invalid role';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    raise exception 'User with this email has not signed up yet';
  end if;

  insert into public.project_members(project_id, user_id, role, created_by)
  values (p_project_id, v_user, p_role, auth.uid())
  on conflict (project_id, user_id) do update set role = excluded.role;

  return v_user;
end;
$$;

create or replace function public.prepare_location_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, now());
    new.revision = coalesce(new.revision, 1);
  else
    new.updated_at = now();
    new.updated_by = coalesce(auth.uid(), new.updated_by);
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists locations_prepare_audit on public.locations;
create trigger locations_prepare_audit
before insert or update on public.locations
for each row execute function public.prepare_location_audit();

create or replace function public.prepare_photo_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, now());
  else
    new.updated_at = now();
    new.updated_by = coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists photos_prepare_audit on public.photos;
create trigger photos_prepare_audit
before insert or update on public.photos
for each row execute function public.prepare_photo_audit();

create or replace function public.log_location_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log(project_id, location_id, actor_id, action, entity_type, entity_id, payload)
  values (
    coalesce(new.project_id, old.project_id),
    coalesce(new.id, old.id),
    auth.uid(),
    lower(tg_op),
    'location',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'DELETE'
      then jsonb_build_object('old', to_jsonb(old))
      when tg_op = 'INSERT'
      then jsonb_build_object('new', to_jsonb(new))
      else jsonb_build_object('old_revision', old.revision, 'new_revision', new.revision)
    end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists locations_activity on public.locations;
create trigger locations_activity
after insert or update or delete on public.locations
for each row execute function public.log_location_activity();

create or replace function public.get_public_report(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'snapshot', r.snapshot,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'expires_at', r.expires_at
  )
  from public.reports r
  where r.public_token = p_token
    and r.revoked_at is null
    and (r.expires_at is null or r.expires_at > now())
  limit 1;
$$;

-- Timestamp triggers

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
for each row execute function public.set_updated_at();

-- Row Level Security

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.locations enable row level security;
alter table public.photos enable row level security;
alter table public.reports enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists profiles_select_related on public.profiles;
create policy profiles_select_related on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists projects_select_members on public.projects;
create policy projects_select_members on public.projects
for select to authenticated
using (public.is_project_member(id));

drop policy if exists projects_update_owners on public.projects;
create policy projects_update_owners on public.projects
for update to authenticated
using (public.has_project_role(id, array['owner']))
with check (public.has_project_role(id, array['owner']));

drop policy if exists members_select_members on public.project_members;
create policy members_select_members on public.project_members
for select to authenticated
using (public.is_project_member(project_id));

drop policy if exists members_insert_owners on public.project_members;
create policy members_insert_owners on public.project_members
for insert to authenticated
with check (public.has_project_role(project_id, array['owner']));

drop policy if exists members_update_owners on public.project_members;
create policy members_update_owners on public.project_members
for update to authenticated
using (public.has_project_role(project_id, array['owner']))
with check (public.has_project_role(project_id, array['owner']));

drop policy if exists members_delete_owners on public.project_members;
create policy members_delete_owners on public.project_members
for delete to authenticated
using (public.has_project_role(project_id, array['owner']));

drop policy if exists locations_select_members on public.locations;
create policy locations_select_members on public.locations
for select to authenticated
using (public.is_project_member(project_id));

drop policy if exists locations_insert_editors on public.locations;
create policy locations_insert_editors on public.locations
for insert to authenticated
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists locations_update_editors on public.locations;
create policy locations_update_editors on public.locations
for update to authenticated
using (public.has_project_role(project_id, array['owner','editor']))
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists locations_delete_editors on public.locations;
create policy locations_delete_editors on public.locations
for delete to authenticated
using (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists photos_select_members on public.photos;
create policy photos_select_members on public.photos
for select to authenticated
using (public.is_project_member(project_id));

drop policy if exists photos_insert_editors on public.photos;
create policy photos_insert_editors on public.photos
for insert to authenticated
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists photos_update_editors on public.photos;
create policy photos_update_editors on public.photos
for update to authenticated
using (public.has_project_role(project_id, array['owner','editor']))
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists photos_delete_editors on public.photos;
create policy photos_delete_editors on public.photos
for delete to authenticated
using (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists reports_select_members on public.reports;
create policy reports_select_members on public.reports
for select to authenticated
using (public.is_project_member(project_id));

drop policy if exists reports_insert_editors on public.reports;
create policy reports_insert_editors on public.reports
for insert to authenticated
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists reports_update_editors on public.reports;
create policy reports_update_editors on public.reports
for update to authenticated
using (public.has_project_role(project_id, array['owner','editor']))
with check (public.has_project_role(project_id, array['owner','editor']));

drop policy if exists reports_delete_owners on public.reports;
create policy reports_delete_owners on public.reports
for delete to authenticated
using (public.has_project_role(project_id, array['owner']));

drop policy if exists activity_select_members on public.activity_log;
create policy activity_select_members on public.activity_log
for select to authenticated
using (public.is_project_member(project_id));

-- Grants

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select on public.activity_log to authenticated;
grant execute on function public.claim_bogatka_project() to authenticated;
grant execute on function public.add_project_member_by_email(uuid,text,text) to authenticated;
grant execute on function public.get_public_report(text) to anon, authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid,text[]) to authenticated;

-- Private photo storage bucket

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'bogatka-photos',
  'bogatka-photos',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bogatka_storage_select on storage.objects;
create policy bogatka_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'bogatka-photos'
  and public.is_project_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists bogatka_storage_insert on storage.objects;
create policy bogatka_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bogatka-photos'
  and public.has_project_role(public.safe_uuid((storage.foldername(name))[1]), array['owner','editor'])
);

drop policy if exists bogatka_storage_update on storage.objects;
create policy bogatka_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'bogatka-photos'
  and public.has_project_role(public.safe_uuid((storage.foldername(name))[1]), array['owner','editor'])
)
with check (
  bucket_id = 'bogatka-photos'
  and public.has_project_role(public.safe_uuid((storage.foldername(name))[1]), array['owner','editor'])
);

drop policy if exists bogatka_storage_delete on storage.objects;
create policy bogatka_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'bogatka-photos'
  and public.has_project_role(public.safe_uuid((storage.foldername(name))[1]), array['owner','editor'])
);

-- Realtime tables

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;

commit;
