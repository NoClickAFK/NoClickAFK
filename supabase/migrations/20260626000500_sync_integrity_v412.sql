-- Bogatka 4.1.2: stop repeated no-op writes from incrementing revisions,
-- firing realtime events, and producing an endless device-to-device sync loop.

create or replace function public.prepare_location_audit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, now());
    new.revision = coalesce(new.revision, 1);
    return new;
  end if;

  -- Clients may retry the same row while handling realtime notifications.
  -- Ignore writes whose business payload is identical. Audit-only columns are
  -- deliberately excluded from the comparison.
  if (to_jsonb(new) - 'updated_at' - 'updated_by' - 'revision')
     = (to_jsonb(old) - 'updated_at' - 'updated_by' - 'revision') then
    return null;
  end if;

  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  new.revision = old.revision + 1;
  return new;
end;
$$;

comment on function public.prepare_location_audit() is
  'Maintains location audit columns and suppresses semantically identical updates to prevent realtime sync loops.';
