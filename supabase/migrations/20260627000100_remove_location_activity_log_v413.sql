begin;

drop trigger if exists locations_activity on public.locations;

delete from public.activity_log;

comment on table public.activity_log is
  'Legacy technical activity journal. Automatic per-update logging is disabled; current project data is stored in projects, project_state, locations, photos, reports and related tables.';

commit;
